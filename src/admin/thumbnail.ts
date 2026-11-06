import { api, ApiError } from '../api/client.ts'

export type ThumbnailResource = 'contents' | 'curriculums'
export const THUMBNAIL_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024

export function thumbnailFileError(file: Pick<File, 'size' | 'type' | 'name'>): string | null {
  if (!file.size) return '빈 이미지 파일은 등록할 수 없어요.'
  if (file.size > MAX_THUMBNAIL_BYTES) return '이미지는 최대 10MB까지 등록할 수 있어요.'
  if (
    file.type
      ? !THUMBNAIL_ACCEPT.split(',').includes(file.type)
      : !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    return 'JPEG, PNG, WebP 이미지를 선택해 주세요.'
  return null
}

export async function saveThumbnail(
  resource: ThumbnailResource,
  id: number,
  actorId: number,
  file: File,
) {
  const error = thumbnailFileError(file)
  if (error) throw new Error(error)
  const body = new FormData()
  body.append('file', file)
  await api<void>(`/${resource}/${id}/thumbnail`, { method: 'PUT', actorId, body })
}

export async function deleteThumbnail(resource: ThumbnailResource, id: number, actorId: number) {
  try {
    await api<void>(`/${resource}/${id}/thumbnail`, { method: 'DELETE', actorId })
    return true
  } catch (error) {
    // 시리즈의 표시 이미지는 첫 영상의 이미지일 수 있다. 원본 콘텐츠 이미지는 삭제하지 않는다.
    if (error instanceof ApiError && error.code === 'THUMBNAIL_NOT_FOUND') return false
    throw error
  }
}
