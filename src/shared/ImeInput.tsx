import { useRef, useState, type ComponentPropsWithRef } from 'react'

type Props = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onCompositionStart' | 'onCompositionEnd'
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export function ImeInput({ value, defaultValue, onValueChange, onKeyDown, ...props }: Props) {
  const [draft, setDraft] = useState(value ?? defaultValue ?? '')
  const [previousValue, setPreviousValue] = useState(value)
  const [inComposition, setInComposition] = useState(false)
  const composing = useRef(false)

  // URL 이동·조건 초기화는 반영하되, 조합 중인 글자를 이전 검색어로 덮어쓰지 않는다.
  if (value !== previousValue) {
    setPreviousValue(value)
    if (!inComposition && value !== undefined) setDraft(value)
  }

  return (
    <input
      {...props}
      value={value === undefined ? undefined : draft}
      defaultValue={value === undefined ? defaultValue : undefined}
      onCompositionStart={() => {
        composing.current = true
        setInComposition(true)
      }}
      onCompositionEnd={(event) => {
        composing.current = false
        setInComposition(false)
        setDraft(event.currentTarget.value)
        onValueChange?.(event.currentTarget.value)
      }}
      onChange={(event) => {
        const next = event.currentTarget.value
        setDraft(next)
        if (!composing.current && !(event.nativeEvent as InputEvent).isComposing)
          onValueChange?.(next)
      }}
      onKeyDown={(event) => {
        if (
          composing.current ||
          event.nativeEvent.isComposing ||
          event.nativeEvent.keyCode === 229
        ) {
          if (event.key === 'Enter') event.preventDefault()
          return
        }
        onKeyDown?.(event)
      }}
    />
  )
}
