# Prompt — Grafite Notas (Frontend Mockado)

Você vai construir o frontend completo de um aplicativo web mobile-first chamado **Grafite Notas** — um app de anotações pessoais com identidade visual premium, instalável como PWA. Esta é a fase de frontend visual: **toda a lógica de negócio, persistência, sync e IA será integrada depois por outra ferramenta**. Sua tarefa é entregar um frontend visualmente completo, polido, navegável, com dados mockados realistas em português brasileiro.

---

## 1. Stack Técnica Obrigatória

- **Next.js 14+** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** com configuração customizada via design tokens
- **shadcn/ui** como base de componentes
- **Framer Motion** para todas as transições e micro-interações
- **Zustand** para estado de UI (sidebar, modais, filtros ativos)
- **lucide-react** para ícones
- Configurar como **PWA** (manifest.json, service worker básico, ícones, splash screen, theme-color, display standalone)
- **Mobile-first absoluto:** viewport base 380px de largura. Adaptações para tablet/desktop são bônus, não prioridade.

**Importante:** não implementar SQLite, IndexedDB, Google Drive API, embeddings, OCR ou qualquer integração real. Tudo mockado em arquivos `mocks/` com dados estáticos. Botões e ações disparam estados visuais (loading, success) com `setTimeout`, mas sem persistência.

---

## 2. Identidade Visual — "Grafite Premium" (variante Notas)

### 2.1 Paleta

```
--bg-base:        #111210   /* grafite quente, fundo principal */
--bg-surface:     #1A1B18   /* superfície de cards */
--bg-elevated:    #22231F   /* cards elevados / modais */
--bg-overlay:     rgba(17, 18, 16, 0.85)

--border-subtle:  #2A2B27
--border-default: #35362F
--border-strong:  #4A4B43

--text-primary:   #E8E6DF   /* off-white quente */
--text-secondary: #A5A39A
--text-muted:     #6B695F
--text-disabled:  #44433D

--accent-amber:   #E8A547   /* âmbar-mel — acento principal do Notas */
--accent-amber-soft: #E8A54720
--accent-amber-glow: #E8A54740
--accent-gold:    #D4AF37   /* dourado — acento secundário, ações premium */

--success:        #6FA86F   /* verde dessaturado */
--danger:         #C56B5F   /* vermelho dessaturado */
--warning:        #D9A441   /* amarelo dessaturado */
```

**Regra de uso:** âmbar é o protagonista. Dourado aparece em ações raras (vault, premium, backup completo). Nada de cor saturada — tudo dessaturado, quente, "fumacento".

### 2.2 Tipografia

- **UI / sans:** `Inter`, fallback `system-ui`. Pesos 400, 500, 600.
- **Leitura / serif:** `Newsreader` (Google Fonts) ou `Source Serif Pro`. Pesos 400, 500, 600 + itálico.
- **Mono (código inline em notas):** `JetBrains Mono`, peso 400.

**Regra crítica:** o editor e o modo de leitura usam SERIF. A UI (timeline, botões, settings, headers) usa SANS. Essa troca é o que dá sensação de "caderno" ao ler/escrever.

Escala tipográfica:
```
text-xs:   11px / 16px
text-sm:   13px / 20px
text-base: 15px / 24px
text-lg:   17px / 26px
text-xl:   20px / 30px
text-2xl:  24px / 32px
text-3xl:  30px / 38px

reading-base: 17px / 30px  (serif, body do editor)
reading-lg:   19px / 32px  (serif, modo leitura)
```

### 2.3 Espaçamento e raios

- Base de 4px (Tailwind default).
- Raios: cards `rounded-2xl` (16px), botões `rounded-xl` (12px), inputs `rounded-lg` (8px), FAB `rounded-full`.
- Padding interno de cards: `p-5` (20px). Gap entre cards: `gap-3` (12px).
- Safe areas respeitadas: `env(safe-area-inset-*)` no topo/fundo.

### 2.4 Os cinco efeitos visuais (assinatura do app)

Implemente todos com cuidado, são a alma do produto:

1. **Noise texture nas superfícies de card**
   SVG inline com `feTurbulence` em filtro CSS, aplicado como pseudo-elemento `::before` com `mix-blend-mode: overlay` e opacidade 0.04. Quase invisível, mas dá textura orgânica de papel cru.

2. **Cursor com glow âmbar ao digitar**
   No editor, o caret tem `caret-color: var(--accent-amber)` e durante o input ativo um box-shadow sutil de 4-6px de glow âmbar pulsa em torno da linha ativa. Usar Framer Motion com `animate` repeat.

3. **Pulse dot âmbar no indicador de backup/sync**
   Pequeno círculo de 6px no canto superior direito da tela. Quando "sincronizando": pulse contínuo (scale 1 → 1.4, opacity 1 → 0.3, infinite). Quando "ok": estático e dourado. Quando "erro": vermelho dessaturado e estático.

4. **Transição "página de livro" ao abrir uma nota**
   Ao tocar num card da timeline, ele expande para tela cheia com `layoutId` do Framer Motion + um leve parallax (background da timeline desliza 20px pra cima enquanto o card sobe). Duração 320ms, easing `[0.32, 0.72, 0, 1]`.

5. **Animação de "tinta" ao salvar / criar nota**
   Quando uma nova nota é criada ou salva (toast trigger), uma onda âmbar suave atravessa o card de baixo pra cima (0.6s, ease-out). Sutil, não cintilante.

Bônus: barras de progresso e skeletons usam **shimmer** dessaturado, nunca branco puro.

---

## 3. Arquitetura de Telas

O app tem 6 telas principais + modais. Tudo mobile-first.

### 3.1 Tela: Timeline (rota `/`)

A home. Feed cronológico vertical.

**Estrutura:**
- **Top bar fixa** (altura 56px): à esquerda, logo "Grafite" em sans 600 com ponto âmbar no "i". À direita: pulse dot de sync + avatar circular (mockado).
- **Barra de busca sticky** logo abaixo (não desce com scroll, mas hides on scroll down / shows on scroll up). Input com ícone de lupa e placeholder serif itálico: *"o que você está procurando?"*. Ao focar, expande e mostra chips de sugestão abaixo.
- **Filter chips horizontais** (scroll horizontal, sem barra visível): *Tudo, Hoje, Esta semana, Com áudio, Com foto, Tarefas, Fixadas, Vault*. Chip ativo: fundo âmbar 20% + texto âmbar + borda âmbar.
- **Feed vertical** de cards de nota. Cada card:
  - Padding 20px, fundo `--bg-surface`, borda `--border-subtle`, raio 16px, noise overlay.
  - Topo do card: linha com data relativa em `text-muted text-xs` ("há 2 horas", "ontem", "ter, 18 mai") + ícones de atributos à direita (🎙️ se tem áudio, 📷 se tem foto, ✓ se tem tarefas, 📌 se fixada, 🔒 se vault).
  - Título em sans 600 text-base (se a nota tiver título; senão, primeira linha do conteúdo).
  - Preview de 2-3 linhas em serif text-sm cor `--text-secondary`, `line-clamp-3`.
  - Se tem foto: thumbnail 100% width no rodapé do card, raio 12px, height 160px, `object-cover`.
  - Se tem áudio: barra de player mini no rodapé (waveform fake estática + duração).
  - Se tem checkboxes: mostrar até 3 com status, "+N restantes" se mais.
  - Tags no rodapé (chips minúsculos, fundo `--bg-elevated`, texto âmbar text-xs).
- **FAB dourado-âmbar** fixo bottom-right (96px do fundo se houver navbar, senão 24px). 56x56, sombra dourada sutil, ícone de "+" branco. Long press abre menu radial (ver §3.7).
- **Bottom navbar** fixa (altura 64px + safe area): ícones de Timeline (ativo), Diário, Vault, Settings. Item ativo com âmbar + label visível; inativos só ícone em `--text-muted`.

**Mocks da timeline:** 15-20 notas variadas em pt-BR:
- Uma de reunião com checkboxes ("Reunião com cliente — terça"), 4 tasks, 2 marcadas.
- Uma só com foto de quadro branco e OCR transcrito embaixo ("OCR: arquitetura microsserviços...").
- Uma transcrição de áudio de 2min ("Ideias pro app de finanças — gravado caminhando").
- Uma longa, fichamento de livro ("Pensar Rápido e Devagar — Cap. 3").
- Uma rápida tipo "comprar café, sabão, fralda".
- Uma fixada no topo ("Senhas e códigos importantes" — marcada como vault, conteúdo borrado).
- Uma com link card ("Artigo: Local-first software" + preview).
- Algumas notas curtas estilo tweet.
- Datas distribuídas entre hoje, ontem, esta semana, semana passada.

### 3.2 Tela: Editor (rota `/note/[id]` e `/note/new`)

Tela de edição/leitura. Esta é a peça mais importante visualmente.

**Estrutura:**
- **Top bar minimal** (48px): seta de voltar à esquerda. À direita: ícone de "mais" (3 pontos verticais) que abre bottom sheet com ações (fixar, mover pra vault, exportar, deletar, ver backlinks).
- **Indicador de "salvando..."** discreto à direita do top bar — texto `text-xs text-muted` que muda entre "salvando...", "salvo há instantes", "salvo há 2min". Pulse dot âmbar mini ao lado quando salvando.
- **Área de título:** input grande, serif 600 text-3xl, placeholder serif itálico *"sem título"*. Sem borda, sem fundo. Só o texto.
- **Linha de metadados:** data de criação em sans text-xs muted + chips de tags inline editáveis (clica adiciona, X remove).
- **Editor principal:** textarea/contentEditable com serif `reading-base` (17px / 30px). Padding lateral 20px. **Cursor glow âmbar ativo.**
  - Suporte visual a markdown: detectar enquanto digita e renderizar inline:
    - `# título` vira heading
    - `- [ ] item` vira checkbox interativa
    - `> citação` vira blockquote com barra âmbar à esquerda
    - `**negrito**`, `_itálico_`, `\`código\``
    - `---` vira divider
    - Links viram clicáveis (sublinhado âmbar)
  - **Não precisa parser real de markdown** — pode fingir com regex simples ou só renderizar estáticos no mock.
- **Toolbar flutuante** que aparece ao selecionar texto: pílula horizontal preta com noise, opções B / I / S / link / `</>` / "✨ IA". Animação de slide up + fade.
- **Toolbar inferior fixa** (acima do teclado): ícones em linha — ✓ checkbox, 📷 foto, 🎙️ áudio, # tag, / template, ✨ IA. Cada um abre uma ação ou bottom sheet.
- **Bottom sheet "IA"** (mock): lista de ações — *Resumir, Virar tarefas, Expandir, Traduzir, Corrigir português, Transformar em tópicos*. Cada uma com ícone âmbar e descrição em text-xs muted.
- **Bottom sheet "Template"**: lista pré-definida — *Reunião, Fichamento, Brainstorm, Diário, Lista de compras, Receita*. Cada um inserir um template ao tocar.

**Estado de gravação de áudio (mock):**
Ao tocar no ícone 🎙️, abre overlay full-screen tipo "modo dictado":
- Fundo `--bg-base` com noise mais forte.
- Centro: visualizador de waveform animado (barras verticais com alturas variando aleatoriamente em loop, âmbar).
- Abaixo: texto sendo "transcrito ao vivo" em serif text-lg, com efeito de cursor piscando no fim. Pode ser um texto mockado que vai aparecendo letra por letra.
- Timer mm:ss âmbar.
- Botão "parar" grande, dourado, circular, no fundo.
- Botão "cancelar" texto, top esquerdo.

**Modo leitura (toggle no menu de ações):**
- Esconde toolbars.
- Aumenta serif pra `reading-lg` (19px / 32px).
- Aumenta padding lateral pra 28px.
- Fundo levemente mais escuro pra contraste.
- Float button discreto "voltar a editar" no canto.

**Wikilinks e conexões entre notas (estilo Obsidian):**

- **Wikilinks `[[ ]]`:** ao digitar `[[` no editor, abre um bottom sheet de autocomplete com a lista de notas (busca conforme digita). Selecionar insere um link `[[Título da Nota]]` que renderiza como texto âmbar sublinhado, tocável. Tocar navega para a nota (com transição livro). No mock, o autocomplete lista os títulos das 20 notas mockadas.
- **Seção "Mencionada em" (backlinks automáticos):** no rodapé de cada nota no editor/modo leitura, uma seção colapsável com header sans 600 text-sm uppercase muted: *"Mencionada em (3)"*. Lista cards compactos das notas que linkam para a atual. No mock, definir manualmente algumas relações entre as notas.
- **Menções não-linkadas:** abaixo dos backlinks, uma segunda seção sutil: *"4 notas mencionam este título sem link"* com um botão âmbar discreto "conectar todas". Puramente visual no mock.
- **Mini-mapa de vizinhança:** botão no menu de ações "ver conexões" abre um modal com um mapa visual leve — a nota atual como nó central (círculo âmbar maior), e 4-6 notas conectadas ao redor (círculos menores `--bg-elevated`), ligadas por linhas finas `--border-strong`. Cada nó é tocável e mostra o título. Layout radial simples, SVG ou divs posicionados — **não usar biblioteca de grafo**. Animação de entrada com stagger (nós aparecem do centro pra fora). Arrastar o mapa faz pan leve. Sem zoom, sem física complexa.

### 3.3 Tela: Diário (rota `/journal`)

Visão agrupada por dia das notas que vc escreveu.

**Estrutura:**
- Top bar com seletor de mês (mai. 2026 com setinhas pra navegar).
- Calendário heatmap horizontal scrollável: 35 quadradinhos (5 semanas), cor mais densa quanto mais notas naquele dia. Hoje destacado com borda âmbar.
- Lista de dias abaixo, agrupados:
  - Header do dia: "quarta, 21 de maio" em serif 500 text-xl + contagem "(4 notas)" em muted.
  - Sob cada dia, cards de nota compactos (mais densos que a timeline normal — só título + 1 linha de preview + horário).
- Vazio: alguns dias sem notas mostram só "—" cinza muted, dão sensação de continuidade temporal.

### 3.4 Tela: Vault (rota `/vault`)

Acesso protegido (mockado).

**Estado bloqueado (default):**
- Fundo `--bg-base`, centralizado vertical.
- Ícone de cadeado grande dourado com glow leve.
- Texto serif text-xl: *"Vault protegido"*.
- Texto sans text-sm muted: *"toque para autenticar"*.
- Botão âmbar grande "Usar biometria" (mock — clica e abre o vault).

**Estado destrancado:**
- Igual à timeline, mas só com notas do vault. Border âmbar dourado nos cards. Indicador "🔒 Vault" no top bar.
- Auto-lock após 30s ociosa (não precisa implementar timer real, mas mostrar config disso).

### 3.5 Tela: Settings (rota `/settings`)

Lista de seções, padrão iOS-like.

**Seções:**

1. **Backup**
   - Card destacado no topo com status: "Último backup: há 7 minutos" + pulse dot dourado + botão "Fazer backup agora".
   - "Frequência" → select (15min / 1h / 4h / Apenas ao fechar / Manual)
   - "Conta Google" → "wellerson@gmail.com" mockado + botão "trocar conta"
   - "Restaurar de backup" → lista 5 snapshots mockados com data/hora e tamanho ("21/05 14:32 · 4.2MB")
   - "Espaço usado no Drive" → barrinha mostrando "12.4 MB de 15 GB"

2. **Aparência**
   - Tema: Grafite Dark (ativo) / Grafite Light (em breve)
   - Tipografia de leitura: Newsreader (ativa) / Source Serif / Iowan
   - Tamanho da fonte: slider 14 → 22px
   - "Efeitos de partícula" toggle (ativo)
   - "Reduzir movimento" toggle

3. **IA**
   - Provedor: Gemini (gratuito) / Claude / OpenAI / Desativado
   - Mostrar resumo automático em notas longas (toggle)
   - Ações rápidas habilitadas (multi-select)

4. **Vault e Privacidade**
   - Biometria pra abrir vault (toggle ativo)
   - Auto-lock: 30s / 1min / 5min / Nunca
   - "Esquecer histórico de busca" botão danger

5. **Sobre**
   - Versão 0.1.0
   - "Exportar tudo" → botão (mock abre toast "preparando export...")
   - "Importar de outro app" → button
   - Links: termos, privacidade, github

Cada seção é um card `--bg-surface`, com header de seção em sans 600 text-sm uppercase muted, e items com divider sutil.

### 3.6 Tela: Busca expandida (rota `/search` ou modal)

Quando o usuário foca a barra de busca da timeline, ela expande em full-screen:

- Input grande no topo, autofocus.
- Abaixo, **abas**: *Texto / Semântica / Tags / Datas*.
  - **Texto**: matching exato, highlights âmbar nos trechos encontrados.
  - **Semântica**: matching por significado, mostra "% de relevância" em barra mini âmbar.
  - **Tags**: lista de todas as tags com contagem, clica filtra.
  - **Datas**: date picker range.
- Sugestões recentes em chips quando o input está vazio.
- Resultado vazio: ilustração serifada minimalista + texto serif itálico *"nada por aqui ainda..."*.

### 3.7 FAB Long Press — Menu Radial

Ao segurar o FAB por 300ms, ele "explode" em 4 opções radiais (Framer Motion com stagger):
- 🎙️ Áudio (esquerda)
- 📷 Foto (cima-esquerda)
- ✓ Tarefa (cima-direita)
- 🔗 Link (direita)

Cada opção é um circle 48px, fundo `--bg-elevated`, borda âmbar, com tooltip embaixo. Toque fora cancela. Toque numa opção dispara navegação para `/note/new` com o modo inicial setado.

---

## 4. Componentes-Chave (criar separadamente em `/components`)

- `<NoteCard />` — card da timeline com todas as variações (com foto, áudio, tarefas, vault, etc.)
- `<SyncIndicator />` — pulse dot reativo a estados
- `<NoiseOverlay />` — pseudo-element wrapper aplicável a qualquer surface
- `<MarkdownEditor />` — textarea contentEditable com formatação inline mockada
- `<FloatingToolbar />` — toolbar de seleção
- `<BottomToolbar />` — toolbar inferior do editor
- `<FAB />` com long-press behavior
- `<AmberCaret />` — wrapper que adiciona glow ao cursor ativo
- `<PageTransition />` — wrapper Framer Motion pra transição livro
- `<ChipScroller />` — scroll horizontal de chips
- `<TimelineHeader />` — top bar reusável
- `<BottomNav />` — navbar inferior
- `<RadialMenu />` — menu radial do FAB
- `<HeatmapCalendar />` — heatmap do diário
- `<ParticleField />` — campo de partículas reativo (modos: splash, audio, touch)
- `<WikilinkAutocomplete />` — bottom sheet de autocomplete ao digitar `[[`
- `<BacklinksSection />` — seção "Mencionada em" + menções não-linkadas
- `<NeighborhoodMap />` — mini-mapa radial de conexões da nota
- `<SwipeBackWrapper />` — wrapper que adiciona gesto de voltar por swipe na borda

---

## 5. Dados Mockados (criar em `/mocks/notes.ts`)

20 notas variadas em **português brasileiro**, com contexto realista (alguém que mistura trabalho, estudo, vida pessoal). Estrutura sugerida:

```ts
type Note = {
  id: string;
  title: string | null;
  content: string;       // markdown
  createdAt: string;     // ISO
  updatedAt: string;
  tags: string[];
  pinned: boolean;
  inVault: boolean;
  attachments: {
    photos?: { url: string; ocrText?: string }[];
    audio?: { url: string; duration: number; transcript: string };
    links?: { url: string; title: string; description: string; image: string }[];
  };
  tasks?: { text: string; done: boolean }[];
  linkedNoteIds?: string[];   // notas que esta nota referencia via [[wikilink]]
};
```

Use placeholders de imagem realistas (Unsplash via `images.unsplash.com/photo-...`). Datas distribuídas entre os últimos 14 dias. Conteúdo variado e crível: nada de "Lorem ipsum".

Exemplos do mood:
- "Reunião com o time de design — feedback do protótipo"
- "Ideias pro app de finanças — gravado caminhando"
- "Receita: estrogonofe de cogumelos"
- "Livro: Pensar Rápido e Devagar (cap. 3 — heurísticas)"
- "Senhas importantes" (vault)
- "Lista de mercado domingo"
- "Mood do dia — segunda chuvosa"

---

## 6. Padrões de Interação

- **Toques** dão feedback instantâneo: scale 0.97 + opacity 0.9 por 100ms.
- **Swipe num card da timeline:**
  - Esquerda → revela ações destrutivas (arquivar âmbar, deletar vermelho).
  - Direita → revela ações construtivas (fixar dourado, mover pra vault).
- **Pull to refresh** na timeline com pulse dot âmbar girando.
- **Toasts** sobem do bottom, fundo `--bg-elevated`, borda âmbar fina, dismiss em 3s. Stack vertical se múltiplos.
- **Loading states** sempre com shimmer dessaturado, nunca spinner branco.
- **Empty states** sempre com tipografia serif itálica + ilustração minimalista (pode ser emoji ou ícone grande muted).

### 6.1 Navegação gestual estilo iOS

O app deve sentir-se nativo. Implementar com Framer Motion:

- **Swipe-to-go-back:** arrastar a partir da borda esquerda da tela (zona de ~20px) para a direita volta à tela anterior. Durante o gesto, a tela atual desliza para a direita acompanhando o dedo, e a tela anterior aparece embaixo com parallax (move-se de -25% até 0). Soltar após 40% da largura completa a navegação; antes disso, volta com spring. Aplicar principalmente na transição Editor → Timeline.
- **Bottom sheets arrastáveis:** todos os menus inferiores (IA, Templates, Ações da nota, Autocomplete de wikilink) sobem como sheet com handle (barrinha cinza no topo). Arrastáveis para baixo para fechar, com resistência elástica. Snap points onde fizer sentido (meio / cheio). Backdrop escurece progressivamente conforme o sheet sobe.
- **Spring physics em tudo:** nenhuma animação linear. Usar `type: "spring"` com `stiffness` ~300, `damping` ~30 para a maioria das transições. O "settle" elástico é parte da identidade.
- **Transições entre abas da bottom nav:** fade + leve slide horizontal na direção da aba (aba à direita entra da direita).
- **Resistência de scroll (rubber-band):** no topo e fundo das listas, leve over-scroll elástico.

Observação: priorizar que o gesto funcione bem; se conflitar com o gesto nativo do navegador, manter a versão por botão sempre disponível como fallback.

---

## 6.2 Particle Field — campo de partículas reativo

Efeito de partículas leves (estilo "campo magnético") em **três contextos específicos**. Implementar em **Canvas 2D** (não WebGL), com 40-60 partículas no máximo, partículas pequenas (1-3px) em tons grafite/âmbar dessaturado. Deve ser leve o suficiente para rodar a 60fps em mobile.

1. **Splash screen:** atrás do logo "Grafite", campo de partículas que deriva suavemente. Reage ao **giroscópio** do aparelho (`DeviceOrientationEvent`) — inclinar o celular faz as partículas derivarem na direção da inclinação, com delay elástico. Dura ~1s e some junto com a splash. Se a permissão de giroscópio não existir, partículas só flutuam lentamente.

2. **Overlay de gravação de áudio:** as partículas se organizam ao redor do centro e reagem à **amplitude do áudio** (no mock, usar um valor de amplitude simulado oscilando) — som alto agita e afasta as partículas; silêncio, elas assentam de volta. Substitui/complementa a waveform como elemento principal.

3. **Empty states:** campo de partículas lento que segue o **toque/arraste do dedo** com delay elástico (efeito magnético — as partículas perseguem o ponto de toque com lag suave). Transforma a tela vazia num momento lúdico.

**Controle obrigatório:** adicionar em Settings → Aparência um toggle **"Efeitos de partícula"** (on por padrão). O efeito também deve respeitar o toggle **"Reduzir movimento"** e a media query `prefers-reduced-motion` — quando qualquer um estiver ativo, desabilitar completamente o Particle Field. Criar como componente isolado `<ParticleField mode="splash | audio | touch" />`.

---

## 7. PWA Setup

- `manifest.json` com nome "Grafite Notas", short_name "Grafite", theme_color `#111210`, background_color `#111210`, display "standalone", orientation "portrait".
- Ícones 192 e 512 (pode usar um placeholder com fundo grafite e letra "G" em âmbar serifada).
- Splash screen com a mesma estética: fundo grafite, "Grafite" centralizado serif âmbar pulsando levemente.
- Service worker registrado mas vazio (sem cache strategy real ainda).
- Meta tags: viewport com `viewport-fit=cover`, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style black-translucent.

---

## 8. O que NÃO fazer

- ❌ Não usar gradientes coloridos saturados em nenhum lugar.
- ❌ Não usar sombras pesadas pretas; usar âmbar/dourado em opacidade baixa quando precisar de elevação.
- ❌ Não usar emojis decorativos no UI (apenas em ações específicas como atributos de nota).
- ❌ Não usar fontes "modernas decorativas" tipo Poppins, Montserrat — fica Inter + Newsreader.
- ❌ Não fazer animação que dure mais de 400ms.
- ❌ Não preencher tudo de noise — só em surfaces de card, sutilmente.
- ❌ Não usar bordas arredondadas exageradas (pill shapes) em cards.
- ❌ Não centralizar texto desnecessariamente — alinhado à esquerda é o default.

---

## 9. Entrega Esperada

- Projeto Next.js inicializado, roda com `npm run dev` sem erros.
- Todas as 6 telas + modais navegáveis.
- Mocks robustos em pt-BR, com relações entre notas definidas (`linkedNoteIds`).
- Componentes isolados e reutilizáveis.
- Wikilinks, backlinks automáticos, menções não-linkadas e mini-mapa de vizinhança funcionando visualmente.
- Navegação gestual iOS (swipe-to-go-back, bottom sheets arrastáveis, spring physics).
- Particle Field nos três contextos, com toggle em Settings.
- Mobile-first, testado em viewport 380px.
- PWA installável.
- Sem qualquer lógica de negócio real — só UI viva, navegável, animada.
- Comentários no código onde a lógica real será conectada depois (ex: `// TODO: integrar com SQLite WASM`).

Capriche nos detalhes. O objetivo é que ao abrir o app no celular eu sinta que estou usando um produto premium pronto, mesmo sabendo que por baixo é tudo mockado. **A diferença está nos cinco efeitos visuais, na tipografia serif/sans dual, na navegação gestual nativa e no respeito ao mobile-first.**

Vai.