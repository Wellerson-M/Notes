export type Note = {
  id: string
  title: string | null
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
  pinned: boolean
  inVault: boolean
  attachments: {
    photos?: { url: string; ocrText?: string }[]
    audio?: { url: string; duration: number; transcript: string }
    links?: { url: string; title: string; description: string; image: string }[]
  }
  tasks?: { text: string; done: boolean }[]
  linkedNoteIds?: string[]
  /** Exclusão lógica — necessária para o sync propagar deleções entre aparelhos */
  deleted?: boolean
}

/** Registro local: a nota mais o controle de sync (nunca vai para o servidor) */
export type LocalNote = Note & { dirty: 0 | 1 }
