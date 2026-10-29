import { useState } from 'react'
import type { AdminCategory } from '../api/admin'
import { AutocompleteInput } from './AutocompleteInput'

export function CategoryInput({
  value,
  options,
  onChange,
  pending,
  invalid,
  describedBy,
}: {
  value: string
  options: AdminCategory[]
  onChange: (value: string) => void
  pending: boolean
  invalid: boolean
  describedBy?: string
}) {
  const [search, setSearch] = useState<string | null>(null)
  const selectedName =
    options.find((category) => String(category.category_id) === value)?.name ?? ''
  return (
    <AutocompleteInput
      id="content-category"
      placeholder={
        pending ? '불러오는 중…' : search !== null && selectedName ? selectedName : '분야 검색'
      }
      listLabel="분야 검색 결과"
      value={search ?? selectedName}
      options={options.map((category) => ({
        id: String(category.category_id),
        label: category.name,
      }))}
      maxLength={30}
      showAll
      onOpen={() => setSearch('')}
      onClose={() => setSearch(null)}
      onChange={setSearch}
      onSelect={(option) => {
        onChange(option.id)
        setSearch(null)
      }}
      invalid={invalid}
      describedBy={describedBy}
    />
  )
}
