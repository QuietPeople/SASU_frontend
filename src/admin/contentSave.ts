import type { QueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AdminTag, EditableContent, UploadedVideo } from '../api/admin'
import { invalidateContentChange } from '../api/queryInvalidation'
import {
  contentMetadataBody,
  contentSignature,
  resolveContentTags,
  type ContentFields,
  type ContentTag,
} from './contentEditor'
import { editVersion } from './editVersion'
import { UploadNeedsReviewError } from './uploadRecovery'
import { deleteThumbnail, saveThumbnail } from './thumbnail'

export type SaveStage = 'tags' | 'metadata' | 'video' | 'thumbnail' | 'publish'

export interface ContentSaveInput {
  publish: boolean
  actorId: number
  generation: number | null
  form: ContentFields
  tags: ContentTag[]
  file: File | null
  thumbnailFile?: File | null
  removeThumbnail?: boolean
  saved?: EditableContent
}

export interface ContentSaveEffects {
  cache: QueryClient
  upload: (options: {
    contentId: number
    file: File
    expectedMediaRevision?: string | null
    generateThumbnail: boolean
  }) => Promise<UploadedVideo>
  onStage: (stage: SaveStage) => void
  onTags: (tags: ContentTag[]) => void
  onSaved: (content: EditableContent) => void
  onBaseline: (signature: string) => void
  onVideoSaved: () => void
  onThumbnailSaved: () => void
  onWarning: (message: string) => void
}

export async function persistContent(
  {
    publish,
    actorId,
    generation,
    form,
    tags,
    file,
    thumbnailFile,
    removeThumbnail,
    saved,
  }: ContentSaveInput,
  {
    cache,
    upload,
    onStage,
    onTags,
    onSaved,
    onBaseline,
    onVideoSaved,
    onThumbnailSaved,
    onWarning,
  }: ContentSaveEffects,
) {
  let current = saved
  let completedMetadata = false
  let tagsChanged = false
  const operation: { stage: SaveStage } = { stage: 'tags' }
  const startStage = (next: SaveStage) => {
    operation.stage = next
    onStage(next)
  }
  try {
    const expectedVersion = saved ? editVersion(saved.updated_at) : undefined
    startStage('tags')
    const uniqueTags = await resolveContentTags(tags, async (name) => {
      const tag = await api<AdminTag>('/tags', { method: 'POST', actorId, body: { name } })
      tagsChanged = true
      return tag
    })
    onTags(uniqueTags)
    startStage('metadata')
    current = await api<EditableContent>(
      current ? `/contents/${current.detail.content.content_id}` : '/contents',
      {
        method: current ? 'PATCH' : 'POST',
        actorId,
        body: {
          ...contentMetadataBody(form, uniqueTags),
          ...(current ? { expected_updated_at: expectedVersion } : {}),
        },
      },
    )
    onSaved(current)
    onBaseline(contentSignature(form, uniqueTags))
    completedMetadata = true
    if (file) {
      startStage('video')
      const uploaded = await upload({
        contentId: current.detail.content.content_id,
        file,
        expectedMediaRevision: saved?.detail.content.media_revision,
        generateThumbnail: !thumbnailFile && !removeThumbnail,
      })
      current = {
        ...current,
        detail: { ...current.detail, content: { ...current.detail.content, ...uploaded } },
        missing_for_publish: current.missing_for_publish.filter((field) => field !== 'video'),
      }
      onSaved(current)
      onVideoSaved()
      try {
        current = await api<EditableContent>(
          `/contents/${current.detail.content.content_id}?view=editor`,
          { actorId },
        )
        onSaved(current)
      } catch {
        onWarning('영상은 저장됐어요. 최신 정보를 다시 불러와 주세요.')
      }
    }
    if (thumbnailFile || removeThumbnail) {
      startStage('thumbnail')
      const contentId = current.detail.content.content_id
      if (thumbnailFile) {
        await saveThumbnail('contents', contentId, actorId, thumbnailFile)
      } else {
        await deleteThumbnail('contents', contentId, actorId)
        current = {
          ...current,
          detail: {
            ...current.detail,
            content: { ...current.detail.content, thumbnail_url: null },
          },
        }
        onSaved(current)
      }
      onThumbnailSaved()
      try {
        current = await api<EditableContent>(`/contents/${contentId}?view=editor`, { actorId })
        onSaved(current)
      } catch {
        onWarning('썸네일 변경은 저장됐어요. 최신 정보를 다시 불러와 주세요.')
      }
    }
    if (publish) {
      startStage('publish')
      current = await api<EditableContent>(
        `/contents/${current.detail.content.content_id}/publish`,
        { method: 'POST', actorId },
      )
      onSaved(current)
    }
    cache.setQueryData(
      ['admin', actorId, generation, `/contents/${current.detail.content.content_id}?view=editor`],
      current,
    )
    await invalidateContentChange(cache, {
      contentId: current.detail.content.content_id,
      tagsChanged,
    })
    return current
  } catch (cause) {
    const prefix = completedMetadata
      ? operation.stage === 'video'
        ? '콘텐츠 정보는 저장됐지만 영상 업로드에 실패했어요. 선택한 파일은 유지돼요. '
        : operation.stage === 'thumbnail'
          ? '콘텐츠는 저장됐지만 썸네일 변경에 실패했어요. 선택한 변경사항은 유지돼요. '
          : operation.stage === 'publish'
            ? '콘텐츠는 저장됐지만 공개에 실패했어요. '
            : ''
      : ''
    if (current) {
      cache.setQueryData(
        [
          'admin',
          actorId,
          generation,
          `/contents/${current.detail.content.content_id}?view=editor`,
        ],
        current,
      )
    }
    if (completedMetadata || tagsChanged)
      await invalidateContentChange(cache, {
        contentId: completedMetadata ? current?.detail.content.content_id : undefined,
        tagsChanged,
      })
    if (cause instanceof UploadNeedsReviewError) throw cause
    throw new Error(
      `${prefix}${cause instanceof Error ? cause.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.'}`,
      { cause },
    )
  }
}
