import type { AdminTag } from '../api/admin'
import { AutocompleteInput } from './AutocompleteInput'

export function TagInput({
  value,
  options,
  onChange,
  onSelect,
  onAdd,
  invalid,
  describedBy,
}: {
  value: string
  options: AdminTag[]
  onChange: (value: string) => void
  onSelect: (tag: AdminTag) => void
  onAdd: () => void
  invalid: boolean
  describedBy: string
}) {
  return (
    <AutocompleteInput
      id="content-tag-input"
      placeholder="태그 입력"
      listLabel="태그 자동완성"
      prefix="#"
      value={value}
      options={options.map((tag) => ({ id: String(tag.tag_id), label: tag.name }))}
      onChange={onChange}
      onSelect={(option) => {
        const tag = options.find((tag) => String(tag.tag_id) === option.id)
        if (tag) onSelect(tag)
      }}
      onConfirm={onAdd}
      invalid={invalid}
      describedBy={describedBy}
    />
  )
}
