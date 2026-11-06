export type ContentSubviewKind = 'edit' | 'materials' | 'stats'

export interface ContentSubview {
  contentId: number
  onClose: () => void
  onTitleChange?: (title: string | null) => void
  onDeleted?: (pending: boolean) => void
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  onOpenMaterials: () => void
}
