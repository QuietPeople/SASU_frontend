export interface ApiPage<T> {
  items: T[]
  page: number
  size: number
  total: number
  has_next: boolean
}

export class ApiError extends Error {
  status: number
  code: string
  fields: unknown

  constructor(status: number, code: string, message: string, fields?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  actorId?: number | null
  generation?: number | null
  signal?: AbortSignal
  keepalive?: boolean
}

export const GENERATION_MISMATCH_EVENT = 'sasu:record-generation-mismatch'

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  if (options.actorId != null) headers.set('X-Actor-Id', String(options.actorId))
  if (options.generation != null) {
    headers.set('X-Record-Generation', String(options.generation))
  }
  const multipart = options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
  const url =
    path.startsWith('/api/') || path === '/api'
      ? path
      : `/api${path.startsWith('/') ? path : `/${path}`}`
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal,
      keepalive: options.keepalive,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
  }
  const raw = await response.text()
  let data: unknown
  try {
    data = raw ? JSON.parse(raw) : undefined
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', '서버 응답을 읽지 못했습니다.')
  }
  if (!response.ok) {
    const detail = (
      data as { detail?: { code?: string; message?: string; fields?: unknown } } | undefined
    )?.detail
    const code = detail?.code ?? `HTTP_${response.status}`
    if (code === 'RECORD_GENERATION_MISMATCH' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GENERATION_MISMATCH_EVENT))
    }
    throw new ApiError(
      response.status,
      code,
      detail?.message ?? '요청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.',
      detail?.fields,
    )
  }
  return data as T
}

type QueryValue = string | number | boolean | null | undefined

export function queryString(params: Record<string, QueryValue | readonly QueryValue[]>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null && item !== '') query.append(key, String(item))
    }
  }
  const result = query.toString()
  return result ? `?${result}` : ''
}

export function mediaUrl(path: string): string {
  return path
}
