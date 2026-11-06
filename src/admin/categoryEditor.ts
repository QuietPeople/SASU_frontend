export interface CategoryDraft {
  id: number | null
  name: string
  original: string
}

export function categoryDirty(draft: CategoryDraft | null) {
  return !!draft && draft.name.trim() !== draft.original.trim()
}

export function categoryNameError(
  draft: CategoryDraft,
  categories: { category_id: number; name: string }[],
) {
  const name = draft.name.trim()
  if (!name) return '분야명을 입력해 주세요.'
  if ([...name].length > 30) return '분야명은 30자 이하로 입력해 주세요.'
  if (draft.id !== null && categories.some((c) => c.category_id !== draft.id && c.name === name))
    return '이미 사용 중인 분야명이에요. 다른 이름을 입력해 주세요.'
  return ''
}
