# Arquitetura

> Como o Grafite Notas funciona por dentro. Leia antes de mexer em dados, sync, IA ou cache.

## Visão geral

```
 Aparelho (navegador / PWA)                          Vercel (Next.js)                Nuvem
┌──────────────────────────────────┐   POST /api/sync   ┌───────────────────┐   ┌──────────────────┐
│ Telas (React)                    │ ─────────────────▶ │ app/api/sync      │──▶│ MongoDB Atlas    │
│   │ useNotes / useNote (reativo) │ ◀───────────────── │  (última escrita  │   │ coleção "notes"  │
│   ▼                              │  notas alteradas   │   vence)          │   └──────────────────┘
│ lib/repo.ts ──▶ IndexedDB (Dexie)│                    ├───────────────────┤   ┌──────────────────┐
│               fonte da verdade   │   POST /api/ai     │ app/api/ai        │──▶│ Google Gemini    │
│ lib/sync.ts (dirty → servidor)   │ ─────────────────▶ │  (chave só aqui)  │   │ (plano grátis)   │
│ public/sw.js (casca offline)     │   /api/auth        ├───────────────────┤   └──────────────────┘
│ lib/updates.ts (versão nova?)    │   /api/version     │ cookie de sessão  │
└──────────────────────────────────┘                    └───────────────────┘
```

**Princípio:** o aparelho nunca espera a rede. Tudo grava primeiro no IndexedDB, e a interface reage ao banco local. A nuvem é uma cópia que serve para levar as notas a outros aparelhos.

## Mapa do código

```
app/
  page.tsx               timeline (filtros, pull-to-refresh = sync)
  note/page.tsx          /note?id=<id> abre nota · /note?mode=text|task|audio cria
  assistant/             assistente conversacional (texto e voz)
  journal/ vault/ search/ settings/
  api/sync/route.ts      push/pull de notas com o Atlas
  api/auth/route.ts      login (POST), status (GET), logout (DELETE)
  api/ai/route.ts        transform | suggest | assistant → Gemini
  api/version/route.ts   versão do deploy no ar
  layout.tsx             registra o service worker, monta AppBoot e Toast
  globals.css            design tokens + coluna central no PC

components/
  NoteEditor.tsx         editor único (nota nova e existente): salvamento, menu, IA
  AISheets.tsx           folhas de resultado da IA e de sugestões
  AppBoot.tsx            efeitos globais: auto-sync, atualização, nota de boas-vindas
  MarkdownEditor.tsx     editor/preview markdown, tarefas clicáveis, [[wikilinks]]
  WikiLink.tsx           [[Título]] → link para a nota
  AudioRecorder.tsx      tela de ditado (usa hooks/useSpeech.ts)
  ...                    cards, barras, folhas e efeitos visuais

lib/
  types.ts               tipo Note (o contrato de dados do app inteiro)
  notes.ts               helpers puros: datas, prévia, tarefas, wikilinks, backlinks
  db.ts                  Dexie: tabelas notes e meta
  repo.ts                notesRepo (CRUD) + hooks useNotes/useNote
  sync.ts                sincronização com /api/sync
  ai.ts / ai-types.ts    cliente da IA e contrato com /api/ai
  auth.ts / mongo.ts     só servidor (import 'server-only')
  routes.ts              noteHref(id), newNoteHref(mode)
  updates.ts             atualização automática do app instalado
  recent-searches.ts     histórico de busca (localStorage)

hooks/useSpeech.ts       Web Speech API em pt-BR
store/ui.ts              Zustand: só estado de interface (filtro, toast, status do sync…)
public/sw.js             service worker (cache offline)
scripts/e2e.cjs          teste ponta a ponta
```

## Dados

`Note` (`lib/types.ts`):

| Campo | Observação |
|---|---|
| `id` | UUID (ou fallback se `crypto.randomUUID` não existir, como em http na rede local) |
| `title`, `content` | `content` é markdown |
| `createdAt`, `updatedAt` | ISO 8601; `updatedAt` decide os conflitos |
| `tags`, `pinned`, `inVault` | |
| `tasks`, `linkedNoteIds` | **derivados** do conteúdo a cada gravação (`- [ ]` e `[[Título]]`) |
| `deleted` | exclusão lógica, necessária para o sync levar a deleção aos outros aparelhos |
| `attachments` | estrutura herdada do protótipo; fotos e áudio ainda não existem de verdade |

No aparelho, cada nota tem também `dirty: 0 | 1`. No Atlas, o documento usa `_id` = id da nota e um `syncedAt` (horário do servidor, usado como cursor).

**Regra:** telas nunca falam com o Dexie direto. Use `notesRepo` e `useNotes`/`useNote` de `lib/repo.ts`. As duas exceções conscientes são `WikiLink.tsx` (consulta pontual por título) e `AppBoot.tsx` (nota de boas-vindas com id fixo).

## Sincronização (`lib/sync.ts` ↔ `app/api/sync`)

1. Toda gravação pelo `notesRepo` marca `dirty: 1` e agenda um sync para 2s depois.
2. O sync envia `{ since: cursor, notes: [sujas] }`.
3. O servidor faz upsert **só se** o `updatedAt` recebido for mais novo que o do Atlas. Se não for, a colisão (E11000) é ignorada de propósito.
4. O servidor devolve todas as notas com `syncedAt >= since` e um cursor novo, com 5s de sobreposição para cobrir gravações concorrentes. Reaplicar uma nota é inofensivo.
5. No aparelho, a marca de sujo só é limpa se a nota não mudou enquanto a requisição estava no ar. As notas recebidas substituem as locais se as locais estiverem limpas ou forem mais velhas.

**Quando sincroniza:** ao abrir, 2s depois de editar, ao voltar a internet, ao voltar para o app, a cada 5 minutos, no pull-to-refresh e pelo botão em Ajustes.

**Limitação conhecida:** o conflito é resolvido por nota inteira. Se a mesma nota for editada offline em dois aparelhos, a edição mais antiga se perde (ver ROADMAP).

**Status** (`store/ui.ts → syncStatus`): `ok`, `syncing`, `error`, `offline` e `unauthorized`. Aparece no ponto ao lado do ✨ e em Ajustes.

## Login (`lib/auth.ts`)

Usuário único. `POST /api/auth` compara a senha com `APP_PASSWORD` (comparação em tempo constante e 800ms de atraso quando erra) e grava o cookie `grafite_session` (httpOnly, 1 ano). O valor do cookie é `HMAC-SHA256(APP_PASSWORD, "grafite-session-v1")`: **trocar a senha desloga todos os aparelhos**. `/api/sync` e `/api/ai` exigem o cookie.

Sem login, o app funciona normalmente, só que sem nuvem e sem IA.

## IA (`app/api/ai` + `lib/ai.ts`)

A chave do Gemini fica só no servidor. O modelo padrão é `gemini-flash-latest`, trocável por `GEMINI_MODEL`. Há três tipos de pedido:

| `kind` | Uso | Resposta |
|---|---|---|
| `transform` | resumir, tarefas, expandir, traduzir, corrigir, tópicos | `{ text }`, que o usuário escolhe se substitui ou acrescenta |
| `suggest` | botão "Sugestões" no editor | `{ title, tags, related[], ideas[] }` (JSON com schema) |
| `assistant` | tela do assistente | `{ reply, noteIds[], actions[] }`, com ações `create_note`, `append_to_note` e `open_note` |

**Contexto enviado:** `buildDigests` escolhe até 40 notas (palavras em comum com o pedido, mais recência e fixadas), com prévia de 400 caracteres cada. **Notas do Vault nunca entram.** Ações propostas pela IA só são aplicadas quando o usuário toca no botão, e ids inventados pela IA são descartados na interface.

**Erros:** `503` quando falta a chave, `429` quando o limite gratuito acaba e `502` nos demais casos. Todos viram mensagens em português na interface.

## Voz (`hooks/useSpeech.ts`)

Usa `SpeechRecognition`/`webkitSpeechRecognition` em `pt-BR`, contínuo e com resultados parciais. O navegador encerra a escuta em silêncios longos, e o hook reinicia sozinho enquanto o usuário não para. Funciona no Chrome (Android e desktop), no Edge e no Safari (iOS 14.5+). No Firefox não existe: aparece uma mensagem pedindo o Chrome. Exige HTTPS (ou localhost) e permissão de microfone.

## Offline (`public/sw.js`)

- **Páginas** (navegação): rede primeiro, cache como reserva. A chave do cache é só o caminho, sem a query.
- **`/_next/static/*`**: cache primeiro, porque os arquivos têm hash e nunca mudam.
- **Payloads RSC** (cabeçalho `RSC: 1`): direto na rede. Se falhar, o Next faz navegação completa e cai no cache de páginas.
- **`/api/*`**: nunca passa pelo cache.
- **Ao instalar**, baixa as 7 páginas e todos os chunks que elas referenciam.

Por isso a rota da nota é `/note?id=` (página estática) e não `/note/[id]`: qualquer nota abre offline, mesmo uma nunca visitada. No `npm run dev`, o service worker é **desregistrado** para não atrapalhar o hot reload.

## Atualização automática (`lib/updates.ts`)

- **Versão:** `next.config.ts` grava `APP_VERSION` no build (commit da Vercel ou carimbo de tempo). `/api/version` devolve a versão que está no ar.
- **Quando confere:** ao abrir, ao voltar para o app, ao voltar a internet e a cada 15 minutos.
- **Versão nova logo ao abrir ou voltar** (sem interação nos primeiros 2,5s): recarrega na hora.
- **Versão nova com o app em uso:** toast persistente "Nova versão disponível · atualizar". Se for ignorado, recarrega na próxima vez que o usuário sair e voltar.
- **Antes de recarregar**, dispara o evento `grafite:flush` para o editor gravar o que estiver pendente.
- **Service worker:** é registrado como `/sw.js?v=<versão>`, então cada deploy instala um novo e apaga os caches antigos.

## Layout celular × PC

Mobile-first, com base de 380px. A partir de 760px de largura, `globals.css` limita `main` a 680px centralizados. Elementos fixos com a classe `.app-bar` (barras e folhas) e `.app-fab` (botões flutuantes) acompanham a coluna. **Todo elemento `position: fixed` novo precisa de uma dessas classes.** No PC, `Esc` fecha as folhas.
