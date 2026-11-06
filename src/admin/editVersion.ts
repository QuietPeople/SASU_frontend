import { ApiError } from '../api/client.ts'

export function editVersion(value: string | null | undefined): string {
  if (!value) throw new ApiError(0, 'EDIT_VERSION_MISSING', '최신 편집 정보를 다시 불러와 주세요.')
  return value
}

export function isEditConflict(error: unknown): boolean {
  if (error instanceof ApiError)
    return error.code === 'EDIT_CONFLICT' || error.code === 'EDIT_VERSION_MISSING'
  return error instanceof Error && error.cause !== undefined && isEditConflict(error.cause)
}
