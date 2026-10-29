import type { AdminTag } from '../api/admin'
import { AutocompleteInput } from './AutocompleteInput'

export function TagInput({
  value,
  options,
  onChange,
  onAdd,
  invalid,
  describedBy,
}: {
  value: string
  options: AdminTag[]
  onChange: (value: string) => void
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
      onSelect={(option) => onChange(option.label)}
      onConfirm={onAdd}
      invalid={invalid}
      describedBy={describedBy}
    />
  )
}
