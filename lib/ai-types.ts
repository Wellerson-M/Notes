/** Contrato entre o app e /api/ai — compartilhado por cliente e servidor */

export type TransformAction = 'summarize' | 'tasks' | 'expand' | 'translate' | 'fix' | 'topics'

/** Resumo enxuto de uma nota enviado como contexto (nunca notas do Vault) */
export type NoteDigest = { id: string; title: string | null; tags: string[]; date: string; text: string; when?: string }

export type AssistantAction =
  | { type: 'create_note'; title: string; content: string; tags: string[]; date?: string; time?: string }
  | { type: 'append_to_note'; noteId: string; content: string }
  | { type: 'open_note'; noteId: string }
  /** Troca um trecho exato (`find` → `replace`; `replace` vazio apaga o trecho) ou, sem `find`, reescreve o conteúdo todo */
  | { type: 'edit_note'; noteId: string; find?: string; replace?: string; content?: string; title?: string }
  | { type: 'delete_note'; noteId: string }

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export type AIRequest =
  | { kind: 'transform'; action: TransformAction; title?: string | null; content: string }
  | { kind: 'suggest'; title?: string | null; content: string; tags: string[]; notes: NoteDigest[] }
  | { kind: 'assistant'; message: string; history: ChatTurn[]; notes: NoteDigest[]; today: string; todayIso?: string; index?: { id: string; title: string }[] }
  /** Foto → texto. `image` é base64 sem o prefixo data: */
  | { kind: 'ocr'; image: string; mimeType: string }
  /** Vetores para a busca por sentido */
  | { kind: 'embed'; texts: string[]; task: 'document' | 'query' }
  /** Retrospectiva de um período (diário) */
  | { kind: 'review'; period: string; notes: NoteDigest[] }
  /**
   * Ditado pela IA: um trecho de áudio gravado no aparelho (base64, sem o prefixo data:).
   * `context` = nomes e termos das notas e o texto antes do cursor, para acertar a grafia.
   */
  | { kind: 'transcribe'; audio: string; mimeType: string; context?: string }
  /** Voz natural: um trecho de texto (já sem markdown) vira áudio .wav */
  | { kind: 'speak'; text: string; voice?: string }

export type Suggestions = {
  title: string
  tags: string[]
  related: { noteId: string; reason: string }[]
  ideas: string[]
}

export type AssistantReply = { reply: string; actions: AssistantAction[]; noteIds: string[] }
