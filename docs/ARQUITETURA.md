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
  api/agenda/            feed .ics da agenda (+ /link)
  api/push/              lembretes: inscrição e padrões, /test, /tick (relógio), /snooze (adiar)
  layout.tsx             registra o service worker, monta AppBoot e Toast
  globals.css            design tokens + coluna central no PC

components/
  NoteEditor.tsx         editor único (nota nova e existente): salvamento, menu, IA, foto, versões
  VersionsSheet.tsx      versões anteriores da nota (prévia e restaurar)
  AISheets.tsx           folhas de resultado da IA e de sugestões
  AppBoot.tsx            efeitos globais: auto-sync, atualização, nota de boas-vindas
  MarkdownEditor.tsx     editor/preview markdown, tarefas clicáveis, [[wikilinks]]
  WikiLink.tsx           [[Título]] → link para a nota
  AudioRecorder.tsx      tela de ditado (usa hooks/useSpeech.ts)
  ...                    cards, barras, folhas e efeitos visuais

lib/
  types.ts               tipo Note (o contrato de dados do app inteiro)
  notes.ts               helpers puros: datas, prévia, tarefas, wikilinks, backlinks
  db.ts                  Dexie: tabelas notes, meta, history, embeddings e secrets
  repo.ts                notesRepo (CRUD, cifra/decifra o Vault, histórico) + hooks useNotes/useNote
  sync.ts                sincronização com /api/sync
  vault.ts               criptografia do Vault (PBKDF2 + AES-GCM), biometria (WebAuthn), auto-trancar
  history.ts             versões anteriores das notas
  semantic.ts            busca por sentido (embeddings no IndexedDB)
  image.ts               reduz fotos antes do OCR
  zip.ts                 .zip mínimo para exportar em markdown
  ai.ts / ai-types.ts    cliente da IA e contrato com /api/ai
  auth.ts / mongo.ts     só servidor (import 'server-only')
  routes.ts              noteHref(id), newNoteHref(mode)
  updates.ts             atualização automática do app instalado
  recent-searches.ts     histórico de busca (localStorage)
  schedule.ts            datas da agenda e .ics
  reminders.ts           lembretes: opções, padrões, fuso (compartilhado com o servidor)
  push.ts / notify.ts    lembretes no servidor (Web Push, relógio) / no aparelho (permissão, inscrição)

hooks/useSpeech.ts       Web Speech API em pt-BR
store/ui.ts              Zustand: só estado de interface (filtro, toast, status do sync…)
public/sw.js             service worker (cache offline)
scripts/e2e*.cjs         testes ponta a ponta (geral, gestos, voz, lembretes)
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
| `cipher` | só em notas do Vault: título, conteúdo e tags cifrados. Os campos em claro ficam vazios |
| `attachments` | estrutura herdada do protótipo; fotos e áudio ainda não existem de verdade |

No aparelho, cada nota tem também `dirty: 0 | 1`. No Atlas, o documento usa `_id` = id da nota e um `syncedAt` (horário do servidor, usado como cursor).

Outras tabelas locais (nunca sincronizadas): `history` (versões anteriores), `embeddings` (vetores da busca por sentido) e `secrets` (chave do Vault liberada pela biometria).

**Regra:** telas nunca falam com o Dexie direto. Use `notesRepo` e `useNotes`/`useNote` de `lib/repo.ts`. As duas exceções conscientes são `WikiLink.tsx` (consulta pontual por título) e `AppBoot.tsx` (nota de boas-vindas com id fixo).

## Sincronização (`lib/sync.ts` ↔ `app/api/sync`)

1. Toda gravação pelo `notesRepo` marca `dirty: 1` e agenda um sync para 2s depois.
2. O sync envia `{ since: cursor, notes: [sujas] }`.
3. O servidor faz upsert **só se** o `updatedAt` recebido for mais novo que o do Atlas. Se não for, a colisão (E11000) é ignorada de propósito.
4. O servidor devolve todas as notas com `syncedAt >= since` e um cursor novo, com 5s de sobreposição para cobrir gravações concorrentes. Reaplicar uma nota é inofensivo.
5. No aparelho, a marca de sujo só é limpa se a nota não mudou enquanto a requisição estava no ar. As notas recebidas substituem as locais se as locais estiverem limpas ou forem mais velhas.

**Quando sincroniza:** ao abrir, 2s depois de editar, ao voltar a internet, ao voltar para o app, a cada 5 minutos, no pull-to-refresh e pelo botão em Ajustes.

**Conflito:** é resolvido por nota inteira. Se a mesma nota for editada offline em dois aparelhos, vence a mais nova, e a perdedora vai para o **histórico** do aparelho dela (motivo "conflito entre aparelhos"). Por isso o sync aplica o que veio do servidor **antes** de limpar as marcas de sujo: é a marca que identifica a edição local que perdeu.

## Histórico de versões (`lib/history.ts`)

Só no aparelho, até 50 versões por nota. Uma versão é guardada ao editar (se a última tiver mais de 10 minutos), quando o sync sobrescreve a nota local e antes de restaurar uma versão. Versões de notas do Vault ficam cifradas. Quando uma nota entra no Vault, as versões antigas em claro são cifradas também.

## Vault (`lib/vault.ts`)

- **Senha do Vault** (diferente da `APP_PASSWORD`) → PBKDF2-SHA256, 310 mil iterações, sal aleatório → chave AES-GCM 256 **não extraível**, que vive só na memória.
- O `notesRepo` cifra `{title, content, tags}` em `cipher` (`gv1.<sal>.<iv>.<dados>`, base64url) antes de gravar. Tarefas, wikilinks e vetores de busca de notas do Vault não são guardados.
- O sal vai dentro de cada `cipher`: outro aparelho deriva a mesma chave com a mesma senha. Se dois aparelhos criarem o Vault com sais diferentes, a mesma senha abre os dois.
- **Trancado:** as notas vêm com `cipher` e sem texto (`isLocked(n)`). Fixar e apagar funcionam; editar lança `VaultLockedError`.
- **Tranca** ao recarregar a página, no botão "Trancar" e depois de 1 minuto com o app em segundo plano.
- **Biometria (opcional, por aparelho):** WebAuthn com autenticador da plataforma. A chave é guardada como CryptoKey não extraível na tabela `secrets` e só é usada depois de o sistema confirmar a digital, o rosto ou o PIN.
- **IA:** notas do Vault nunca são enviadas (`buildDigests` filtra e o editor bloqueia as ações).
- **Sem recuperação:** esquecer a senha = perder as notas do Vault. O backup `.json` leva as notas cifradas.
- **Trocar a senha** (tela do Vault ou Ajustes, `vault.changePassword`): confere a atual, cria um sal novo e recifra todas as notas e versões (cifra tudo antes da transação do Dexie). As notas regravadas sincronizam. Nos outros aparelhos, `unlock` confere a senha numa nota (e não só no verificador local, que ainda é da senha antiga) e adota o sal novo; a biometria de lá é desligada sozinha quando a chave guardada não abre mais as notas.

## Busca por sentido (`lib/semantic.ts`)

Cada nota fora do Vault vira um vetor de 256 dimensões (`gemini-embedding-001`), guardado em `embeddings` com o `updatedAt` da nota. Na busca, só as notas novas ou editadas são reindexadas, em lotes de 50. A pergunta vira um vetor e é comparada com todos no aparelho (produto escalar). O corte fica com o que passa de 0,72 **e** está a até 0,025 da melhor nota, porque os escores desse modelo ficam espremidos entre 0,65 e 0,80.

**Status** (`store/ui.ts → syncStatus`): `ok`, `syncing`, `error`, `offline` e `unauthorized`. Aparece no ponto ao lado do ✨ e em Ajustes.

## Login (`lib/auth.ts`)

Usuário único. `POST /api/auth` confere a senha (comparação em tempo constante e 800ms de atraso quando erra) e grava o cookie `grafite_session` (httpOnly, 1 ano). `/api/sync`, `/api/ai` e `/api/backup` exigem o cookie.

- **Senha de fábrica:** `APP_PASSWORD` (Vercel). Vale enquanto ninguém trocar a senha pelo app.
- **Trocar a senha** (Ajustes → Sincronização → "Trocar senha do app", `POST /api/auth/password`): pede a atual, grava a nova só como hash **scrypt** no Atlas (`app_meta/auth`, com sal e uma "versão") e renova o cookie deste aparelho. Daí em diante a `APP_PASSWORD` não entra mais.
- **Cookie:** `HMAC-SHA256(APP_PASSWORD, "grafite-session-v1|<versão>")`. Trocar a senha muda a versão e **desloga os outros aparelhos**. Cada instância guarda o documento `auth` em memória por 60s.
- **Esqueceu a senha nova?** Apague o documento `auth` da coleção `app_meta` no Atlas: volta a valer a `APP_PASSWORD`.
- A chave da agenda, do relógio dos lembretes e as chaves VAPID continuam derivadas da `APP_PASSWORD` (trocar a senha pelo app não as muda).

Sem login, o app funciona normalmente, só que sem nuvem e sem IA.

## IA (`app/api/ai` + `lib/ai.ts`)

A chave do Gemini fica só no servidor. O modelo padrão é `gemini-flash-lite-latest` (~1,5s por resposta e cota grátis maior), trocável por `GEMINI_MODEL`. O `gemini-flash-latest` é a reserva: "pensa" antes de responder (5–30s) e tem cota diária grátis pequena. Há três tipos de pedido:

| `kind` | Uso | Resposta |
|---|---|---|
| `transform` | resumir, tarefas, expandir, traduzir, corrigir, tópicos | `{ text }`, que o usuário escolhe se substitui ou acrescenta |
| `suggest` | botão "Sugestões" no editor | `{ title, tags, related[], ideas[] }` (JSON com schema) |
| `assistant` | tela do assistente | `{ reply, noteIds[], actions[] }`, com ações `create_note`, `append_to_note`, `edit_note` (troca um trecho exato, apaga um trecho, marca tarefa, renomeia ou reescreve), `delete_note` e `open_note` |
| `ocr` | botão "foto" no editor (imagem reduzida a 1600px/JPEG no aparelho) | `{ text }` em markdown |
| `embed` | busca por sentido | `{ vectors[][] }` normalizados |
| `review` | "Resumo da semana" no diário | `{ text }` em markdown |

**Contexto enviado:** `buildDigests` escolhe até 40 notas (palavras em comum com o pedido e com as últimas falas da conversa, mais recência e fixadas), com prévia de 400 caracteres cada; no assistente, as 4 mais relevantes vão com o **texto completo** (até 4 mil caracteres), para o `edit_note` copiar o trecho exato. Vai também um **índice** com id e título de até 300 outras notas. **Notas do Vault nunca entram.** Ações propostas pela IA só são aplicadas quando o usuário toca no botão ("Aplicar tudo" aplica as pendentes, menos abrir e apagar), e ids inventados pela IA são descartados na interface. Antes de um `edit_note`, a versão anterior vai para o histórico; se o trecho não for achado, nada muda.

**Sobrecarga:** cada tentativa tem 15s. Se o modelo principal responder 500/503 ("high demand"), a rota espera 1s e **repete o mesmo modelo** (o pico do Google costuma durar segundos); se falhar de novo, der 429 (cota do modelo; no plano grátis cada modelo tem a sua) ou estourar o tempo, tenta o reserva. `maxDuration` da rota = 60s. O último erro de cada modelo (status e mensagem do Google) fica no contador de uso e aparece em Ajustes → IA.

**Por que aparecia "sobrecarregada" com pouco uso (13/10/2026):** o Automático mandava foto, "expandir", resumo da semana e textos com mais de 8 mil caracteres direto para o Flash, que no plano grátis estava levando **45 a 90 segundos** por resposta (fila do Google), e o reserva não tinha tempo máximo. A chamada estourava e virava "sobrecarregada". Agora o Automático usa o Flash-Lite (~1s) em tudo e o Flash só de reserva. O Pro dá 429 na hora (sem cota grátis nesta chave), e os modelos 2.5 já não existem para chaves novas (404).

**Erros:** `503` quando falta a chave ou o Google está sobrecarregado, `429` quando o limite gratuito acaba e `502` nos demais casos. Todos viram mensagens em português na interface.

## Voz (`hooks/useSpeech.ts`)

Usa `SpeechRecognition`/`webkitSpeechRecognition` em `pt-BR`, com resultados parciais. O navegador encerra a escuta em silêncios longos, e o hook reinicia sozinho enquanto o usuário não para. **Android:** o modo contínuo do Chrome repete a frase a cada resultado ("oi" → "oi tudo" → "oi tudo bem"), então lá é uma frase por sessão; e o texto é sempre remontado da lista inteira de resultados e juntado por `joinSpeech`, que tira repetições e sobreposições. Funciona no Chrome (Android e desktop), no Edge e no Safari (iOS 14.5+). No Firefox não existe: aparece uma mensagem pedindo o Chrome. Exige HTTPS (ou localhost) e permissão de microfone.

- **Apagar o que falei** (`reset`): descarta o texto e reinicia a sessão do reconhecedor; os resultados antigos da sessão em andamento são ignorados (`skipRef`), senão voltariam no próximo evento.
- **Na nota:** o ditado é uma barra compacta (`DictationBar`) por cima da nota; o texto só entra ao tocar em "Inserir na nota", **no ponto onde o cursor estava** (`EditorHandle.insert`). Não para sozinho em pausas.
- **No assistente:** por padrão envia só no botão (antes cortava a frase depois de 1,2s de silêncio). Em Ajustes → IA dá para ligar o envio automático, que espera 2,8s de silêncio.

## Editor (`components/MarkdownEditor.tsx`)

- **Prévia × edição:** a nota aparece formatada; tocar numa linha abre o textarea com o cursor **naquela linha** (cada linha da prévia tem `data-line`).
- **Altura:** o textarea cresce com o texto (sem rolagem interna) e a tela ganha folga embaixo enquanto se escreve, para o fim de notas longas subir acima do teclado.
- **Barra acima do teclado** (`EditorAccessory`): ditar, tarefa, lista, numerada, título, negrito, ligar nota, citação, divisória, data e hora, e **Concluir** (sai da edição e fica na nota; também no topo). Os botões não tiram o foco do texto. No Android a página encolhe com o teclado (`interactive-widget=resizes-content` no layout); no iPhone, `useKeyboardInset` sobe a barra pela `visualViewport`.
- **Gatilhos no começo da linha:** `-` oferece lista, tarefa ou divisória; `/` abre o menu de inserir. Enter continua listas e numeração; Enter num item vazio encerra a lista.
- **Controle por fora** (`ref` → `EditorHandle`): `insert(texto, { block })` no último cursor conhecido (ditado, templates) e `done()`.

## Conexões e tags sugeridas (`lib/related.ts`)

Tudo no aparelho, sem IA: cada nota vira um vetor TF-IDF das palavras (sem acento, sem palavras vazias, com radical simples para plural/gênero). A semelhança soma o cosseno, tags em comum e, se já existirem, os vetores da busca por sentido (`localVectors`, sem chamar a IA). O Vault fica de fora.

- **Conexões sugeridas** (`RelatedNotes`, no fim da nota): até 6 notas parecidas com o motivo ("#viagem em comum", "fala de orçamento, praia"). "Ligar" põe `[[Título]]` na linha **`Relacionadas:`** no fim da nota (`addRelatedLink`), nunca no meio do texto. O mesmo vale para "ligar" nas sugestões da IA.
- **Tags** (`TagSuggest`): digitando no "+ tag", completa com as tags que já existem; sem digitar, sugere as tags existentes que combinam com o texto ou com as notas parecidas e, se faltar, até 2 palavras fortes do texto como tag nova.

## Backup

- **Cópia diária no servidor** (`lib/backups.ts`, coleção `backups`): uma foto de todas as notas por dia (Vault cifrado), guardada por 14 dias. Feita de carona no sync e no relógio dos lembretes (`after()`, no máximo uma conferência a cada 30 min por instância). Ajustes → Backup lista e baixa (`GET /api/backup?day=`), no mesmo formato do backup .json, que o "Restaurar" aceita.
- **Em arquivo, fora do Atlas** (`lib/backup.ts`): "Enviar backup" abre o compartilhar do sistema (Google Drive, e-mail...) onde existir; "Baixar backup" baixa o .json. O app lembra (toast) se passar de 14 dias sem backup em arquivo.

## Compartilhar para o app

O `manifest.json` declara `share_target` (GET em `/note` com `title`, `text` e `url`). No Android, o app instalado aparece no menu "compartilhar". A nota nasce já salva, com o link no fim. O iPhone não oferece share target para PWAs. O manifest também tem atalhos (segurar o ícone): nova nota, ditar e assistente.

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

## Agenda (`lib/schedule.ts`)

Uma nota pode ter `schedule: { date: 'AAAA-MM-DD', time?: 'HH:MM' }`, sempre no horário local do aparelho (sem fuso: "dia 20 às 9h" é o que a pessoa disse). Ela aparece na tela **Agenda** (`app/journal`: Próximos, Ficou para trás, calendário) e no filtro "Agendadas" da timeline. A data fica fora da cifra mesmo no Vault, mas notas do Vault nunca entram na agenda.

**Agenda do celular**, por dois caminhos:
- **Por nota:** "Agenda do celular" gera um `.ics` e abre o compartilhar do sistema (a Agenda Samsung importa). É na hora, mas é uma cópia: editar a nota não atualiza o evento.
- **Assinatura:** `/api/agenda?k=<chave>` é um feed iCalendar com todas as notas datadas fora do Vault. A chave é `HMAC(APP_PASSWORD, "grafite-calendar-v1")`, porque apps de agenda não mandam cookie (trocar a senha invalida o link). Ajustes → "Agenda do celular" abre o Google Agenda para assinar, e a Agenda Samsung mostra os calendários da conta Google. O Google relê assinaturas no tempo dele (até ~1 dia), e o app do Google Agenda no celular não assina por link: a assinatura é feita no site (de preferência no PC).

## Lembretes (`lib/reminders.ts`, `lib/push.ts`, `lib/notify.ts`)

- **Na nota:** `schedule.remind` = avisos em minutos antes (ausente = padrão dos Ajustes; `[]` = sem aviso). Nas notas do dia todo, o "momento" é o horário dos Ajustes (padrão 9h) do próprio dia.
- **Padrões e fuso** ficam no Atlas (`push_meta`), porque quem dispara é o servidor. As datas das notas são "de parede"; o fuso vem do aparelho que ligou as notificações.
- **Aparelhos:** cada um se inscreve no Web Push (`push_subs`). As chaves VAPID são derivadas da `APP_PASSWORD` (nenhuma variável nova). Trocar a senha troca as chaves, e é preciso ligar de novo em cada aparelho. Inscrição recusada pelo serviço de push (404/410) é apagada.
- **Disparo:** `runReminders` olha as notas datadas de ontem até 8 dias à frente e manda o que venceu nos últimos 45 min. Antes de mandar, reserva a chave `nota|data|hora|antecedência` em `push_sent` (TTL de 14 dias), então chamadas repetidas ou simultâneas nunca avisam duas vezes. Mudar a data gera chaves novas e o aviso volta a valer. Compromisso que já passou não avisa.
- **Quem chama:** `/api/push/tick?k=<HMAC(APP_PASSWORD,"grafite-cron-v1")>` pelo cron-job.org a cada minuto (a Vercel Hobby só tem cron diário), e de carona em cada `/api/sync` (via `after()`, no máximo 1 vez a cada 50s). A resposta do relógio só traz ids, nunca o conteúdo.
- **No aparelho:** `public/sw.js` mostra a notificação (tag = id da nota, então um aviso novo substitui o anterior), com "Adiar 10 min" (`/api/push/snooze`, pelo cookie de sessão) e "Abrir". O Vault avisa só "Lembrete do Vault". No relógio (Zepp/Amazfit), aparece por espelhamento das notificações do celular.

## Modelos e uso da IA (`lib/ai-models.ts`, `lib/usage.ts`)

Cada pedido leva a preferência do aparelho (`auto`, `fast`, `smart`, `pro`; Ajustes → IA). No **Automático**, o Rápido (Flash-Lite) atende tudo, inclusive foto e textos longos; o Inteligente (Flash) só entra de reserva, porque no plano grátis chega a levar 45–90s. Sempre há um reserva (o outro nível) para 429, 500/503 repetido ou mais de 15s.

Toda chamada ao Gemini soma um contador na coleção `ai_usage` (um documento por dia da cota e modelo: pedidos, limites atingidos, erros e tokens). O dia segue o horário do Pacífico, como a cota do Google. `GET /api/ai` devolve o uso de hoje e da semana. O Google não informa quanto resta da cota, então os limites diários exibidos são estimativas; o dado confiável é o "limite atingido" registrado.

## Temas (`lib/theme.ts`)

Sete temas, cada um é um bloco `:root[data-theme="<id>"], [data-theme="<id>"]` em `globals.css` (gerado entre `TEMAS:INICIO` e `TEMAS:FIM`) que redefine os tokens (`--bg-*`, `--text-*`, `--accent-amber`, `--on-accent`...) e a personalidade: `--ambient` (fundo: estrelas, pauta de caderno, névoa...), `--card-radius`, `--card-shadow` e a fonte dos títulos (`.font-title`). Como o seletor também vale num elemento, as miniaturas do seletor usam `data-theme` e mostram o tema de verdade. Transparências usam as versões RGB (`rgba(var(--accent-rgb), 0.3)`, `--gold-rgb`, `--bg-rgb`), então **nunca escreva cor fixa num componente**. A escolha fica no `localStorage` do aparelho e é aplicada por um script no `<head>` antes da primeira pintura, junto com a `theme-color` da barra do sistema. O canvas das partículas lê `--accent-rgb` com `getComputedStyle`.

## Layout celular × PC

Mobile-first, com base de 380px. A partir de 760px de largura, `globals.css` limita `main` a 680px centralizados. Elementos fixos com a classe `.app-bar` (barras e folhas) e `.app-fab` (botões flutuantes) acompanham a coluna. **Todo elemento `position: fixed` novo precisa de uma dessas classes.** No PC, `Esc` fecha as folhas.
