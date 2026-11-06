import { queryString } from '../api/client.ts'

const PREFIX = 'sasu.admin.view.'
export function readAdminView(key: string) {
  try {
    return sessionStorage.getItem(PREFIX + key) ?? ''
  } catch {
    return ''
  }
}
export function writeAdminView(key: string, value: string) {
  try {
    sessionStorage.setItem(PREFIX + key, value)
  } catch {
    /* 화면 탐색은 계속한다. */
  }
}
export function adminPage(value: string | null) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? number : 1
}
export function adminId(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : undefined
}
export function adminStatus(value: string | null) {
  return value === 'DRAFT' || value === 'PUBLISHED' || value === 'PRIVATE' ? value : 'ALL'
}
export function adminFilters(params: URLSearchParams, values: Record<string, string>) {
  const next = new URLSearchParams(params)
  if (Object.keys(values).some((key) => key !== 'page' && key !== 'edit')) next.delete('page')
  for (const [key, value] of Object.entries(values)) {
    if (!value || (key === 'page' && value === '1') || (key === 'status' && value === 'ALL'))
      next.delete(key)
    else next.set(key, value)
  }
  return next
}

export const CONTENT_MISSING_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'video', label: '영상 미등록' },
  { value: 'learning_material', label: '학습자료 미등록' },
  { value: 'either', label: '영상 또는 학습자료 미등록' },
] as const

export function adminMissing(value: string | null) {
  return value === 'video' || value === 'learning_material' || value === 'either'
    ? value
    : undefined
}

export function adminContentListPath(
  params: URLSearchParams,
  { size = 10, status }: { size?: number; status?: ReturnType<typeof adminStatus> } = {},
) {
  return `/contents${queryString({
    q: params.get('q')?.trim() || undefined,
    category_id: adminId(params.get('category_id')),
    status: status ?? adminStatus(params.get('status')),
    missing: adminMissing(params.get('missing')),
    page: status === undefined ? adminPage(params.get('page')) : 1,
    size,
  })}`
}
