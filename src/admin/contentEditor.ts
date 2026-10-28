import type { EditableContent, VideoPolicy } from '../api/admin'

export interface ContentFields {
  title: string
  category: string
  core: string
  source: string
  reviewed: string
  caution: boolean
  cautionText: string
}
export interface ContentTag {
  tag_id?: number
  name: string
}
export const publishFields = [
  { key: 'title', label: '제목', input: 'content-title' },
  { key: 'category', label: '분야', input: 'content-category' },
  { key: 'tags', label: '태그', input: 'content-tag-input' },
  { key: 'core', label: '핵심 정리', input: 'content-core' },
  { key: 'source', label: '출처', input: 'content-source' },
  { key: 'reviewed', label: '검토일', input: 'content-reviewed' },
  { key: 'video', label: '영상', input: 'content-video' },
] as const
export type PublishField = (typeof publishFields)[number]['key']

export function initialFields(content?: EditableContent): ContentFields {
  return {
    title: content?.detail.content.title ?? '',
    category: content?.detail.content.category?.category_id.toString() ?? '',
    core: content?.detail.core_content ?? '',
    source: content?.detail.source ?? '',
    reviewed: content?.detail.reviewed_on ?? '',
    caution: content?.detail.caution_enabled ?? false,
    cautionText: content?.detail.caution_text ?? '',
  }
}

export const TAG_MIN_LENGTH = 2
export const TAG_MAX_LENGTH = 30
export const TITLE_MAX_LENGTH = 200

export type TextField = Exclude<keyof ContentFields, 'caution'>

export function contentFieldError(key: TextField, value: string): string | null {
  const text = value.trim()
  if (!text) {
    const prompts: Record<TextField, string> = {
      title: '제목을 입력해 주세요.',
      category: '목록에서 분야를 선택해 주세요.',
      core: '핵심 정리를 입력해 주세요.',
      source: '참고 자료명 또는 링크를 입력해 주세요.',
      reviewed: '검토일을 선택해 주세요.',
      cautionText: '주의 문구를 입력하거나 표시 설정을 해제해 주세요.',
    }
    return value ? '공백만 입력할 수 없어요.' : prompts[key]
  }
  if (key === 'title' && Array.from(text).length > TITLE_MAX_LENGTH)
    return `최대 길이를 넘었어요. ${TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`
  if (key === 'category' && (!/^\d+$/.test(text) || Number(text) <= 0))
    return '목록에서 분야를 다시 선택해 주세요.'
  if (key === 'reviewed' && !isValidReviewDate(text))
    return '다이얼에서 올바른 검토일을 선택해 주세요.'
  return null
}

export function tagInputError(value: string): string | null {
  const length = Array.from(value.trim()).length
  if (length < TAG_MIN_LENGTH) return `${TAG_MIN_LENGTH}자 이상 입력해 주세요.`
  if (length > TAG_MAX_LENGTH)
    return `최대 길이를 넘었어요. ${TAG_MAX_LENGTH}자 이하로 입력해 주세요.`
  return null
}

export function addContentTag(tags: ContentTag[], draft: string, options: ContentTag[] = []) {
  const name = draft.trim()
  if (tagInputError(name) || tags.some((tag) => tag.name === name)) return tags
  return [...tags, options.find((tag) => tag.name === name) ?? { name }]
}

export function contentSignature(form: ContentFields, tags: ContentTag[]) {
  return JSON.stringify({
    ...form,
    title: form.title.trim(),
    core: form.core.trim(),
    source: form.source.trim(),
    cautionText: form.cautionText.trim(),
    tags: [...new Set(tags.map((tag) => tag.name.trim()))].sort(),
  })
}

export function missingPublishFields(
  form: ContentFields,
  tags: ContentTag[],
  hasVideo: boolean,
): PublishField[] {
  return publishFields
    .filter(({ key }) => {
      if (key === 'tags') return tags.length === 0 || tags.some((tag) => tagInputError(tag.name))
      if (key === 'video') return !hasVideo
      return contentFieldError(key, form[key]) !== null
    })
    .map(({ key }) => key)
}

export function videoSelectionError(
  files: Pick<File, 'name' | 'type' | 'size'>[],
  policy?: VideoPolicy,
): string | null {
  if (files.length !== 1) return '영상 파일을 한 개씩 선택해 주세요.'
  if (!policy) return '영상 업로드 기준을 불러온 뒤 다시 선택해 주세요.'
  const file = files[0]
  const rules = policy.accept
    .toLowerCase()
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
  const extensions = rules.filter((rule) => rule.startsWith('.'))
  const mimeRules = rules.filter((rule) => !rule.startsWith('.'))
  const extensionAllowed = extensions.some((extension) =>
    file.name.toLowerCase().endsWith(extension),
  )
  const mime = file.type.toLowerCase()
  const mimeAllowed = mimeRules.some((rule) =>
    rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule,
  )
  const unknownMime = !mime || mime === 'application/octet-stream'
  if (
    (extensions.length ? !extensionAllowed : !mimeAllowed) ||
    (!unknownMime && mimeRules.length > 0 && !mimeAllowed)
  ) {
    return `지원하지 않는 파일 형식이에요.${extensions.length ? ` ${extensions.join(', ')} 파일을 선택해 주세요.` : ' 지원 형식을 확인해 주세요.'}`
  }
  if (file.size === 0) return '비어 있는 파일은 선택할 수 없어요.'
  if (file.size > policy.max_bytes)
    return `최대 ${Math.round(policy.max_bytes / 1024 / 1024)} MB까지 선택할 수 있어요.`
  return null
}

export function isValidReviewDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const date = new Date(`${value}T00:00:00`)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function localReviewDate(offset: number, now = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + offset)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
