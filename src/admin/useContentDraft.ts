import { useState } from 'react'
import type { AdminTag } from '../api/admin'
import { contentSignature, type ContentFields, type ContentTag } from './contentEditor'

export function useContentDraft(seed: {
  form: ContentFields
  tags: ContentTag[]
  tagDraft: string
  tagSelection?: AdminTag | null
  baseline: string
}) {
  const [form, setForm] = useState(seed.form)
  const [tags, setTags] = useState(seed.tags)
  const [tagDraft, setTagDraft] = useState(seed.tagDraft)
  const [tagSelection, setTagSelection] = useState<AdminTag | null>(seed.tagSelection ?? null)
  const [baseline, setBaseline] = useState(seed.baseline)
  const dirty = !!tagDraft.trim() || contentSignature(form, tags) !== baseline
  return {
    form,
    setForm,
    tags,
    setTags,
    tagDraft,
    setTagDraft,
    tagSelection,
    setTagSelection,
    baseline,
    setBaseline,
    dirty,
  }
}
