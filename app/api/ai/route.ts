import { GoogleGenAI, type GenerateContentParameters } from '@google/genai'
import { isAuthenticated, unauthorized } from '@/lib/auth'
import type { AIRequest, NoteDigest, TransformAction } from '@/lib/ai-types'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'
/** Reserva quando o modelo principal está sobrecarregado (503) — mais leve e quase sempre livre */
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-flash-lite-latest'
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001'
const EMBED_DIMS = 256
const MAX_IMAGE_B64 = 4_000_000
const MAX_EMBED_TEXTS = 100

const BASE = `Você é a IA do "Grafite Notas", um app pessoal de anotações. Responda sempre em português do Brasil,
de forma direta e calorosa, sem floreios. Use markdown simples (títulos ##, listas, **negrito**, tarefas "- [ ] ").`

const TRANSFORMS: Record<TransformAction, string> = {
  summarize: 'Resuma a nota mantendo os pontos principais, em poucas linhas ou tópicos curtos.',
  tasks: 'Extraia todas as ações e pendências da nota como lista de tarefas markdown ("- [ ] ..."). Só a lista.',
  expand: 'Desenvolva as ideias da nota com mais detalhes, exemplos e próximos passos, mantendo o tom do autor.',
  translate: 'Traduza a nota para o inglês, preservando a formatação markdown. Se já estiver em inglês, traduza para português.',
  fix: 'Corrija gramática, ortografia e pontuação da nota sem mudar o sentido, o tom nem a formatação.',
  topics: 'Reestruture a nota como uma lista de tópicos organizada, agrupando assuntos relacionados.',
}

const SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'título curto e claro para a nota (até 60 caracteres)' },
    tags: { type: 'array', items: { type: 'string' }, description: 'de 1 a 4 tags, minúsculas, sem #' },
    related: {
      type: 'array',
      items: {
        type: 'object',
        properties: { noteId: { type: 'string' }, reason: { type: 'string' } },
        required: ['noteId', 'reason'],
      },
      description: 'até 3 notas existentes realmente relacionadas, com o motivo em uma frase',
    },
    ideas: {
      type: 'array',
      items: { type: 'string' },
      description: '2 a 4 sugestões práticas: próximos passos, perguntas em aberto, o que acrescentar',
    },
  },
  required: ['title', 'tags', 'related', 'ideas'],
}

const ASSISTANT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'resposta ao usuário em markdown curto' },
    noteIds: { type: 'array', items: { type: 'string' }, description: 'ids das notas citadas na resposta' },
    actions: {
      type: 'array',
      description: 'ações propostas; o usuário confirma antes de aplicar',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['create_note', 'append_to_note', 'open_note'] },
          noteId: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'noteIds', 'actions'],
}

const ASSISTANT_RULES = `Você é o assistente das notas do usuário. Entenda o pedido em linguagem natural
(pode vir de voz, com erros de transcrição) e:
- se for uma PERGUNTA sobre as notas, responda com base nelas e cite os ids em noteIds;
- se ele quer ANOTAR algo novo, proponha "create_note" com título, conteúdo bem organizado e tags;
- se quer ACRESCENTAR algo a uma nota existente (ex.: "põe leite na lista de compras"), proponha "append_to_note" com o noteId certo e só o trecho novo;
- se quer ABRIR ou achar uma nota, proponha "open_note";
- se for conversa, ideia ou pedido de sugestão, responda e, se fizer sentido, proponha salvar como nota.
Nunca invente ids: use apenas os da lista. Seja breve na resposta.`

const OCR_PROMPT = `Transcreva todo o texto da imagem (pode ser foto de quadro, caderno, livro, print ou documento).
Mantenha a estrutura em markdown: títulos, listas, tabelas simples e tarefas ("- [ ] ") quando houver.
Corrija só erros óbvios de leitura. Devolva apenas o texto, sem comentários.
Se a imagem não tiver texto, descreva-a em uma ou duas frases começando com "Imagem:".`

const REVIEW_RULES = `Escreva em markdown, curto e útil. Use exatamente estes títulos (sem acrescentar nada a eles)
e pule a seção que ficar vazia — nunca escreva "nenhuma decisão" ou parecido:

## Em resumo
(2 a 3 frases sobre o que marcou o período)
## Temas
(os assuntos que mais apareceram, em lista)
## Decisões e ideias
(o que foi decidido ou pensado de importante)
## Pendências
(tarefas abertas como "- [ ] tarefa (título da nota de origem)" — nunca cite ids)
## Para a próxima semana
(1 a 3 sugestões práticas)

As linhas entre parênteses são instruções para você, não copie. Baseie-se só nas notas; não invente fatos.`

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return unauthorized()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'A IA ainda não foi configurada (falta GEMINI_API_KEY).' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as AIRequest | null
  if (!body) return Response.json({ error: 'corpo inválido' }, { status: 400 })

  const ai = new GoogleGenAI({ apiKey })

  try {
    if (body.kind === 'transform') {
      const instruction = TRANSFORMS[body.action]
      if (!instruction) return Response.json({ error: 'ação desconhecida' }, { status: 400 })
      const res = await generate(ai, {
        contents: [
          instruction,
          'Devolva apenas o texto resultante, sem comentários.',
          '',
          `Título: ${body.title ?? '(sem título)'}`,
          '',
          clip(body.content, 20000),
        ].join('\n'),
        config: { systemInstruction: BASE },
      })
      return Response.json({ text: res.text?.trim() ?? '' })
    }

    if (body.kind === 'suggest') {
      const res = await generate(ai, {
        contents: [
          'Analise a nota abaixo e sugira melhorias. Para "related", use somente ids da lista de outras notas.',
          '',
          'NOTA ATUAL',
          `Título: ${body.title ?? '(sem título)'}`,
          `Tags atuais: ${body.tags.join(', ') || '(nenhuma)'}`,
          clip(body.content, 12000),
          '',
          'OUTRAS NOTAS',
          digestBlock(body.notes),
        ].join('\n'),
        config: { systemInstruction: BASE, responseMimeType: 'application/json', responseJsonSchema: SUGGEST_SCHEMA },
      })
      return Response.json(JSON.parse(res.text ?? '{}'))
    }

    if (body.kind === 'assistant') {
      const history = body.history
        .slice(-8)
        .map((t) => `${t.role === 'user' ? 'Usuário' : 'Você'}: ${t.text}`)
        .join('\n')
      const res = await generate(ai, {
        contents: [
          `Hoje é ${body.today}.`,
          ASSISTANT_RULES,
          '',
          'NOTAS DO USUÁRIO (as mais relevantes)',
          digestBlock(body.notes),
          '',
          'CONVERSA ATÉ AGORA',
          history || '(início)',
          '',
          `Usuário: ${clip(body.message, 4000)}`,
        ].join('\n'),
        config: { systemInstruction: BASE, responseMimeType: 'application/json', responseJsonSchema: ASSISTANT_SCHEMA },
      })
      return Response.json(JSON.parse(res.text ?? '{}'))
    }

    if (body.kind === 'ocr') {
      if (typeof body.image !== 'string' || body.image.length > MAX_IMAGE_B64 || !/^image\/(jpeg|png|webp)$/.test(body.mimeType)) {
        return Response.json({ error: 'Imagem inválida ou grande demais.' }, { status: 400 })
      }
      const res = await generate(ai, {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: body.mimeType, data: body.image } },
            { text: OCR_PROMPT },
          ],
        }],
        config: { systemInstruction: BASE },
      })
      return Response.json({ text: res.text?.trim() ?? '' })
    }

    if (body.kind === 'embed') {
      const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, MAX_EMBED_TEXTS).map((t) => clip(String(t), 2000) || ' ')
      if (!texts.length) return Response.json({ vectors: [] })
      const res = await ai.models.embedContent({
        model: EMBED_MODEL,
        contents: texts,
        config: { taskType: body.task === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT', outputDimensionality: EMBED_DIMS },
      })
      return Response.json({ vectors: (res.embeddings ?? []).map((e) => normalize(e.values ?? [])) })
    }

    if (body.kind === 'review') {
      const res = await generate(ai, {
        contents: [
          `Faça uma retrospectiva das anotações do usuário no período: ${body.period}.`,
          REVIEW_RULES,
          '',
          'NOTAS DO PERÍODO',
          digestBlock(body.notes),
        ].join('\n'),
        config: { systemInstruction: BASE },
      })
      return Response.json({ text: res.text?.trim() ?? '' })
    }

    return Response.json({ error: 'tipo desconhecido' }, { status: 400 })
  } catch (err) {
    if ((err as { status?: number }).status === 429) {
      return Response.json(
        { error: 'Limite gratuito da IA atingido por agora. Tente de novo em alguns minutos.' },
        { status: 429 },
      )
    }
    if (overloaded(err)) {
      return Response.json(
        { error: 'A IA do Google está sobrecarregada agora. Tente de novo em instantes.' },
        { status: 503 },
      )
    }
    console.error('[api/ai]', err)
    return Response.json({ error: 'A IA não conseguiu responder agora.' }, { status: 502 })
  }
}

/** Tempo máximo do modelo principal antes de desistir e ir para o reserva */
const PRIMARY_TIMEOUT_MS = 20_000

class Timeout extends Error {}

const overloaded = (err: unknown) =>
  err instanceof Timeout || [500, 503].includes((err as { status?: number }).status ?? 0)

/** No plano grátis cada modelo tem a sua cota: limite (429) no principal também vale tentar o reserva */
const retryable = (err: unknown) => overloaded(err) || (err as { status?: number }).status === 429

/**
 * Gera com o modelo principal; se o Google estiver sobrecarregado (500/503), a cota do modelo
 * acabar (429) ou ele demorar demais, tenta o modelo reserva uma vez.
 */
async function generate(ai: GoogleGenAI, params: Omit<GenerateContentParameters, 'model'>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PRIMARY_TIMEOUT_MS)
  try {
    return await ai.models.generateContent({
      ...params,
      model: MODEL,
      config: { ...params.config, abortSignal: controller.signal },
    })
  } catch (err) {
    const error = controller.signal.aborted ? new Timeout('o modelo principal demorou demais') : err
    if (!retryable(error) || FALLBACK_MODEL === MODEL) throw error
    if (!controller.signal.aborted) await new Promise((r) => setTimeout(r, 800))
    return ai.models.generateContent({ ...params, model: FALLBACK_MODEL })
  } finally {
    clearTimeout(timer)
  }
}

function digestBlock(notes: NoteDigest[]) {
  if (!notes.length) return '(nenhuma nota)'
  return notes
    .map((n) => {
      const tags = n.tags.length ? ` #${n.tags.join(' #')}` : ''
      return `[id:${n.id}] ${n.date} — ${n.title ?? 'sem título'}${tags}\n${n.text}`
    })
    .join('\n---\n')
}

function normalize(v: number[]) {
  // Vetores truncados (outputDimensionality) não vêm normalizados
  const len = Math.hypot(...v) || 1
  return v.map((x) => Math.round((x / len) * 1e5) / 1e5)
}

function clip(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '\n[...]' : text
}
