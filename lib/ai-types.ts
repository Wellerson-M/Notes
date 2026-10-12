/** Contrato entre o app e /api/ai — compartilhado por cliente e servidor */

export type TransformAction = 'summarize' | 'tasks' | 'expand' | 'translate' | 'fix' | 'topics'

/** Resumo enxuto de uma nota enviado como contexto (nunca notas do Vault) */
export type NoteDigest = { id: string; title: string | null; tags: string[]; date: string; text: string }

export type AssistantAction =
  | { type: 'create_note'; title: string; content: string; tags: string[] }
  | { type: 'append_to_note'; noteId: string; content: string }
  | { type: 'open_note'; noteId: string }

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export type AIRequest =
  | { kind: 'transform'; action: TransformAction; title?: string | null; content: string }
  | { kind: 'suggest'; title?: string | null; content: string; tags: string[]; notes: NoteDigest[] }
  | { kind: 'assistant'; message: string; history: ChatTurn[]; notes: NoteDigest[]; today: string }

export type Suggestions = {
  title: string
  tags: string[]
  related: { noteId: string; reason: string }[]
  ideas: string[]
}

export type AssistantReply = { reply: string; actions: AssistantAction[]; noteIds: string[] }
