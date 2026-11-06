import { useState } from 'react'
import { AutocompleteInput } from './AutocompleteInput'
import { Icon } from './Icon'
import './content-filter.css'

export function ContentFilter({
  id,
  label,
  value,
  options,
  disabled = false,
  className = '',
  onChange,
}: {
  id: string
  label: string
  value: string
  options: { id: string; label: string }[]
  disabled?: boolean
  className?: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = useState<string | null>(null)
  const selected = options.find((option) => option.id === value)?.label ?? '선택한 항목'
  return (
    <fieldset className={`admin-filter-select ${className}`} disabled={disabled}>
      <label htmlFor={id}>{label}</label>
      <div className="admin-filter-select__control">
        <AutocompleteInput
          id={id}
          listLabel={`${label} 필터`}
          placeholder={disabled ? '불러오는 중…' : selected}
          value={disabled ? '' : (search ?? selected)}
          showAll
          options={options}
          invalid={false}
          onOpen={() => setSearch('')}
          onClose={() => setSearch(null)}
          onChange={setSearch}
          onSelect={(option) => {
            onChange(option.id)
            setSearch(null)
          }}
        />
        <Icon name="chevronDown" size={15} />
      </div>
    </fieldset>
  )
}
