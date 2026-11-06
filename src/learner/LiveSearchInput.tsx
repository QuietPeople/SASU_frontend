import { useEffect, useEffectEvent, useState, type ComponentPropsWithRef } from 'react'
import { ImeInput } from '../shared/ImeInput'

export function LiveSearchInput({
  value,
  onValueChange,
  disabled,
  ...props
}: Omit<ComponentPropsWithRef<typeof ImeInput>, 'value' | 'defaultValue' | 'onValueChange'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [previous, setPrevious] = useState(value)
  if (previous !== value) {
    setPrevious(value)
    setDraft(value)
  }
  const change = useEffectEvent(onValueChange)
  useEffect(() => {
    if (disabled || draft === value) return
    const timer = window.setTimeout(() => change(draft), 250)
    return () => window.clearTimeout(timer)
  }, [draft, value, disabled])
  return <ImeInput {...props} disabled={disabled} value={draft} onValueChange={setDraft} />
}
