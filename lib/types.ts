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
  /**
   * Notas do Vault guardam título, conteúdo e tags cifrados aqui (AES-GCM, ver lib/vault.ts);
   * os campos em claro ficam vazios. Numa nota lida com o Vault trancado, `cipher` continua
   * presente — é assim que a interface sabe que ela está trancada.
   */
  cipher?: string
  /**
   * Data na agenda (compromisso, prazo, lembrete), no fuso do aparelho: `date` = AAAA-MM-DD e
   * `time` = HH:MM (sem hora = o dia todo). Fica fora da cifra mesmo no Vault, mas notas do Vault
   * nunca vão para o feed da agenda do celular. `remind` = avisos em minutos antes (ausente = padrão
   * dos Ajustes; vazio = sem aviso; ver lib/reminders.ts).
   */
  schedule?: { date: string; time?: string; remind?: number[] }
}

/** Registro local: a nota mais o controle de sync (nunca vai para o servidor) */
export type LocalNote = Note & { dirty: 0 | 1 }
