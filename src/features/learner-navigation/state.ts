export const UI_STATE_PREFIX = 'sasu.learner.ui.'
const memory = new Map<string, unknown>()

export function readView<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T
  try {
    const raw = sessionStorage.getItem(UI_STATE_PREFIX + key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function writeView(key: string, value: unknown) {
  memory.set(key, value)
  try {
    sessionStorage.setItem(UI_STATE_PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장소를 사용할 수 없어도 현재 화면의 조작은 유지한다.
  }
}

export function clearView(key: string) {
  memory.delete(key)
  try {
    sessionStorage.removeItem(UI_STATE_PREFIX + key)
  } catch {
    // 저장소 사용이 제한된 환경에서도 화면 초기화는 계속한다.
  }
}

export function positiveId(value: string | null): number | undefined {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : undefined
}

export type LibraryTab = 'saved' | 'wrong' | 'cards'
export function libraryTab(params: URLSearchParams): LibraryTab {
  const value = params.get('tab')
  return value === 'wrong' || value === 'cards' ? value : 'saved'
}

export function libraryParams(params: URLSearchParams, name: string, value: string) {
  const next = new URLSearchParams(params)
  const currentTab = libraryTab(params)
  const currentPage = positiveId(params.get('page')) ?? 1
  next.set(`${currentTab}_page`, String(currentPage))
  if (name === 'tab') {
    next.set('tab', value)
    next.set('page', String(positiveId(next.get(`${value}_page`)) ?? 1))
  } else if (name === 'concept' || name === 'q' || name === 'reset') {
    const normalized = value.trim()
    if (name === 'reset') {
      next.delete('q')
      next.delete('concept')
    } else if (normalized) next.set(name, normalized)
    else next.delete(name)
    for (const tab of ['saved', 'wrong', 'cards']) next.delete(`${tab}_page`)
    next.delete('page')
  } else {
    next.set('page', value)
    next.set(`${currentTab}_page`, value)
  }
  return next
}

export function reviewCategory(params: URLSearchParams, returnTo: string) {
  return (
    positiveId(params.get('category')) ??
    positiveId(new URLSearchParams(returnTo.split('?')[1]).get('concept'))
  )
}

export function reviewSearch(params: URLSearchParams, returnTo: string) {
  return (params.get('q') ?? new URLSearchParams(returnTo.split('?')[1]).get('q') ?? '').trim()
}

export function safeLibraryReturn(value: string | null | undefined, tab: LibraryTab) {
  if (value && /^\/learner\/library(?:\?|$)/.test(value)) return value
  return `/learner/library?tab=${tab}`
}

export function flashcardLibraryPath(params: URLSearchParams) {
  const backTo = safeLibraryReturn(params.get('returnTo'), 'cards')
  const query = new URLSearchParams(backTo.split('?')[1])
  const next = libraryTab(query) === 'cards' ? query : libraryParams(query, 'tab', 'cards')
  const category = positiveId(params.get('category'))
  const q = params.get('q')?.trim()
  if (!next.has('concept') && category) next.set('concept', String(category))
  if (!next.has('q') && q) next.set('q', q)
  return `/learner/library?${next}`
}

export function learnerErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  if (code === 'RECORD_GENERATION_MISMATCH')
    return '학습 기록이 변경됐어요. 목록을 다시 열어 최신 상태로 이어가 주세요.'
  if (code === 'NETWORK_ERROR') return '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
  const status = error && typeof error === 'object' && 'status' in error ? error.status : 0
  if (code === 'INVALID_RESPONSE' || code === 'INTERNAL_ERROR' || Number(status) >= 500)
    return '서버에서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (error instanceof Error && !/기록 세대|learning_epoch|record_generation/.test(error.message))
    return error.message
  return '요청을 처리하지 못했어요. 목록을 다시 확인하거나 잠시 후 다시 시도해 주세요.'
}
