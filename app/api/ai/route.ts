import { GoogleGenAI, type GenerateContentParameters } from '@google/genai'
import { isAuthenticated, unauthorized } from '@/lib/auth'
import type { AIRequest, NoteDigest, TransformAction } from '@/lib/ai-types'
import { EMBED_LABEL, MODEL_TIERS, pickTiers, type ModelPref, type ModelTier, type TaskInfo } from '@/lib/ai-models'
import { recordUsage, usageReport, type Outcome } from '@/lib/usage'

/**
 * Modelos por nível (trocáveis por variável de ambiente). O Flash-Lite responde em ~1,5s e tem
 * cota grátis maior; o Flash "pensa" antes (5–20s) e a cota diária grátis acaba rápido.
 * Quem escolhe entre eles é a preferência de Ajustes (ou o Automático, em lib/ai-models.ts).
 */
const MODEL_IDS: Record<ModelTier, string> = {
  fast: process.env.GEMINI_MODEL ?? MODEL_TIERS.fast.defaultId,
  smart: process.env.GEMINI_FALLBACK_MODEL ?? MODEL_TIERS.smart.defaultId,
  pro: process.env.GEMINI_PRO_MODEL ?? MODEL_TIERS.pro.defaultId,
}
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? EMBED_LABEL.defaultId
const EMBED_DIMS = 256
const MAX_IMAGE_B64 = 4_000_000
const MAX_EMBED_TEXTS = 100

/** Folga para as tentativas (principal, repetição e reserva) caberem numa chamada só */
export const maxDuration = 60

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
          type: { type: 'string', enum: ['create_note', 'append_to_note', 'edit_note', 'delete_note', 'open_note'] },
          noteId: { type: 'string' },
          title: { type: 'string', description: 'create_note: título; edit_note: novo título, só se for para renomear' },
          content: { type: 'string', description: 'create_note/append_to_note: o texto; edit_note: o conteúdo NOVO inteiro, só quando a mudança for grande demais para find/replace' },
          find: { type: 'string', description: 'edit_note: trecho EXATO copiado da nota (uma linha inteira, de preferência) a ser trocado' },
          replace: { type: 'string', description: 'edit_note: o que entra no lugar de find; vazio = apagar o trecho' },
          tags: { type: 'array', items: { type: 'string' } },
          date: { type: 'string', description: 'só em create_note com data: AAAA-MM-DD' },
          time: { type: 'string', description: 'só se houver hora: HH:MM (24h)' },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'noteIds', 'actions'],
}

const ASSISTANT_RULES = `Você é o assistente das notas do usuário. Entenda o pedido em linguagem natural
(costuma vir de voz: espere erros de transcrição, frases soltas e palavras trocadas; deduza a intenção
pelo sentido e pela conversa até agora — "ela", "essa lista", "a de ontem" se referem ao que acabou de ser falado). Então:
- PERGUNTA sobre as notas: responda com base nelas e cite os ids em noteIds;
- ANOTAR algo novo: "create_note" com título, conteúdo bem organizado e tags;
- ACRESCENTAR a uma nota existente ("põe leite na lista de compras"): "append_to_note" com o noteId certo e só o trecho novo;
- MUDAR, CORRIGIR, TROCAR, MARCAR COMO FEITO ou TIRAR algo de uma nota ("tira o leite", "muda a reunião pra 15h", "marca o pão como comprado", "renomeia para X"): "edit_note".
  Use "find" com o trecho EXATO como está no texto da nota (copie a linha inteira) e "replace" com a versão nova; para tirar, "replace" vazio.
  Marcar tarefa como feita = trocar "- [ ] item" por "- [x] item". Várias mudanças na mesma nota = várias ações edit_note.
  Só use "content" (reescrever tudo) quando o usuário pedir para reorganizar/reescrever a nota inteira. Para renomear, use "title".
- APAGAR uma nota inteira ("apaga a nota X", "pode excluir a lista antiga"): "delete_note" (o usuário confirma antes);
- ABRIR ou achar uma nota: "open_note";
- conversa, ideia ou pedido de sugestão: responda e, se fizer sentido, proponha salvar como nota.
Prefira agir: se o pedido é claro, proponha a ação sem perguntar. Pergunte só quando houver duas notas igualmente
prováveis ou faltar algo essencial. Na resposta, diga em uma frase o que vai ser feito.
"edit_note" com "find" só em notas cujo texto aparece abaixo (copie o trecho de lá). Notas do ÍNDICE (só título)
podem receber "append_to_note", "open_note", "delete_note" ou renomear com "title". Nunca invente ids.

Regras de conteúdo:
- LISTAS de coisas a fazer, comprar, levar ou checar (compras, ingredientes a comprar, tarefas, mala) são SEMPRE checklist, uma por linha: "- [ ] item". Nunca use "- item" nesses casos.
- Quando criar MAIS DE UMA nota relacionada (ex.: receita + lista de compras), LIGUE as notas: no fim do conteúdo de cada uma, escreva "Relacionada: [[Título exato da outra]]".
- DATAS: se o pedido tem um quando (hoje, amanhã, sexta, dia 20, às 9h, semana que vem), preencha "date" (AAAA-MM-DD) e, se houver hora, "time" (HH:MM, 24h) no create_note. Calcule a partir da data de hoje informada. Sem hora dita, deixe "time" vazio.
- Para perguntas sobre agenda ("o que tenho amanhã?"), use as datas marcadas como "📅" nas notas.
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
  const pref = (body as { model?: ModelPref }).model ?? 'auto'
  const [main, backup] = pickTiers(['auto', 'fast', 'smart', 'pro'].includes(pref) ? pref : 'auto', taskInfo(body))
  const generate = generator(ai, [MODEL_IDS[main], MODEL_IDS[backup]])

  try {
    if (body.kind === 'transform') {
      const instruction = TRANSFORMS[body.action]
      if (!instruction) return Response.json({ error: 'ação desconhecida' }, { status: 400 })
      const res = await generate({
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
      const res = await generate({
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
      const res = await generate({
        contents: [
          `Hoje é ${body.today}${body.todayIso ? ` (${body.todayIso})` : ''}.`,
          ASSISTANT_RULES,
          '',
          'NOTAS DO USUÁRIO (as mais relevantes; as primeiras vêm com o texto completo)',
          digestBlock(body.notes),
          '',
          'ÍNDICE DAS OUTRAS NOTAS (só id e título)',
          (Array.isArray(body.index) ? body.index : []).slice(0, 300).map((n) => `[id:${n.id}] ${clip(String(n.title), 80)}`).join('\n') || '(nenhuma)',
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
      const res = await generate({
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
      }).catch((err) => { void recordUsage(EMBED_MODEL, outcomeOf(err), undefined, errorLabel(err)); throw err })
      void recordUsage(EMBED_MODEL, 'ok')
      return Response.json({ vectors: (res.embeddings ?? []).map((e) => normalize(e.values ?? [])) })
    }

    if (body.kind === 'review') {
      const res = await generate({
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
    if (err instanceof Timeout) {
      return Response.json({ error: 'A IA demorou demais para responder. Tente de novo.' }, { status: 504 })
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

/** Tempo máximo de cada tentativa antes de desistir e ir para a próxima */
const ATTEMPT_TIMEOUT_MS = 15_000

class Timeout extends Error {}

const statusOf = (err: unknown) => (err as { status?: number }).status ?? 0

const overloaded = (err: unknown) => [500, 503].includes(statusOf(err))

/** No plano grátis cada modelo tem a sua cota: limite (429) no principal também vale tentar o reserva */
const retryable = (err: unknown) => err instanceof Timeout || overloaded(err) || statusOf(err) === 429

const outcomeOf = (err: unknown) => (statusOf(err) === 429 ? 'limited' : 'error') as Outcome

/** Resumo do erro para o contador de uso (Ajustes → IA), sem conteúdo das notas */
const errorLabel = (err: unknown) =>
  err instanceof Timeout ? 'demorou demais' : `${statusOf(err) || '?'} ${String((err as Error)?.message ?? '').slice(0, 120)}`

/**
 * Gerador do pedido. O "sobrecarregado" (500/503) do Google costuma durar segundos, então:
 *  1. tenta o modelo principal;
 *  2. se ele sobrecarregar, tenta o MESMO modelo de novo depois de 1s (normalmente passa);
 *  3. se ainda falhar, estourar a cota (429) ou demorar demais, tenta o reserva.
 * Cada tentativa tem tempo máximo e entra no contador de uso.
 */
function generator(ai: GoogleGenAI, [primary, backup]: [string, string]) {
  const attempt = async (model: string, params: Omit<GenerateContentParameters, 'model'>) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
    try {
      const res = await ai.models.generateContent({ ...params, model, config: { ...params.config, abortSignal: controller.signal } })
      void recordUsage(model, 'ok', res.usageMetadata)
      return res
    } catch (err) {
      const error = controller.signal.aborted ? new Timeout(`${model} demorou demais`) : err
      void recordUsage(model, outcomeOf(error), undefined, errorLabel(error))
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  return async (params: Omit<GenerateContentParameters, 'model'>) => {
    try {
      return await attempt(primary, params)
    } catch (err) {
      if (!retryable(err)) throw err
      if (overloaded(err)) {
        await new Promise((r) => setTimeout(r, 1000))
        try { return await attempt(primary, params) } catch (err2) { if (!retryable(err2)) throw err2 }
      }
      if (backup === primary) throw err
      return attempt(backup, params)
    }
  }
}

/** Tamanho do texto do pedido (para o Automático escolher o modelo) */
function taskInfo(body: AIRequest): TaskInfo {
  const size =
    body.kind === 'transform' || body.kind === 'suggest' ? body.content.length
      : body.kind === 'review' ? body.notes.reduce((s, n) => s + n.text.length, 0)
        : body.kind === 'assistant' ? body.message.length
          : 0
  return { kind: body.kind, action: body.kind === 'transform' ? body.action : undefined, size }
}

/** Relatório de uso para Ajustes: contagem de hoje e da semana, por modelo */
export async function GET() {
  if (!(await isAuthenticated())) return unauthorized()
  try {
    const report = await usageReport()
    return Response.json({
      ...report,
      models: Object.fromEntries(Object.entries(MODEL_IDS).map(([tier, id]) => [tier, { id, ...MODEL_TIERS[tier as ModelTier] }])),
      embed: { id: EMBED_MODEL, ...EMBED_LABEL },
    })
  } catch (err) {
    console.error('[api/ai usage]', err)
    return Response.json({ error: 'Não deu para ler o uso agora.' }, { status: 500 })
  }
}

function digestBlock(notes: NoteDigest[]) {
  if (!notes.length) return '(nenhuma nota)'
  return notes
    .map((n) => {
      const tags = n.tags.length ? ` #${n.tags.join(' #')}` : ''
      const when = n.when ? ` 📅 ${n.when}` : ''
      return `[id:${n.id}] ${n.date} — ${n.title ?? 'sem título'}${tags}${when}\n${n.text}`
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
