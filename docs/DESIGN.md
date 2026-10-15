# Identidade visual — "Grafite Premium"

> Fonte original: [spec/spec-v2.md](spec/spec-v2.md), seção 2. Este resumo é o que precisa ser respeitado no dia a dia.

## Tokens (em `app/globals.css`, `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--bg-base` | `#111210` | fundo do app |
| `--bg-surface` | `#1a1b18` | cards |
| `--bg-elevated` | `#22231f` | inputs, chips, itens de folha |
| `--border-subtle` / `-default` / `-strong` | `#2a2b27` / `#35362f` / `#4a4b43` | bordas |
| `--text-primary` / `-secondary` / `-muted` / `-disabled` | `#e8e6df` / `#a5a39a` / `#6b695f` / `#44433d` | texto |
| `--accent-amber` | `#e8a547` | acento principal, botões, links |
| `--accent-amber-soft` | âmbar 12% | fundos de tag e seleção |
| `--accent-gold` | `#d4af37` | Vault, sync ok |
| `--success` / `--danger` / `--warning` | `#6fa86f` / `#c56b5f` / `#d9a441` | estados |

Tipografia: **Inter** (sans, interface), **Newsreader** (serif, títulos, corpo de nota e estados vazios em itálico) e **JetBrains Mono** (código, timer).

## Regras

- **Mobile-first**, com base de 380px. No PC, coluna central de 680px (ver ARQUITETURA → Layout).
- **Cores só por variável CSS.** Nenhum hex solto em componente. A exceção histórica é `#111210` como texto sobre botão âmbar.
- **Animações de até 400ms**, preferindo spring; nada linear, exceto spinners.
- **Proibido:** gradiente saturado, sombra preta pesada, card em formato de pílula e fonte decorativa. A elevação se faz com âmbar em baixa opacidade.
- Texto alinhado à esquerda. Estados vazios em serif itálico (`components/EmptyState.tsx`).
- Folhas inferiores (`BottomSheet`) com handle, arrastáveis para baixo e que fecham com Esc no PC.
- **Acessibilidade de movimento:** todo efeito novo respeita "Reduzir movimento" e "Efeitos de partícula" (em Ajustes) e `prefers-reduced-motion`.
- Elementos `position: fixed` precisam da classe `.app-bar` ou `.app-fab`.
- Interface em **português do Brasil, com acentos**.

## Os cinco efeitos de assinatura

1. **Textura de ruído** nos cards (`.noise-card`).
2. **Cursor âmbar com brilho** ao digitar (`AmberCaret`).
3. **Ponto pulsante** de sync (`SyncIndicator`): dourado quando ok, âmbar pulsando quando sincroniza, vermelho em erro, cinza quando offline ou sem login.
4. **Transição de página** ao abrir uma nota.
5. **Onda de tinta** âmbar ao salvar (`.ink-wave`).

E mais o **campo de partículas** (`ParticleField`) em três contextos: splash, gravação de voz e estados vazios, e o **fundo de galáxia** nas laterais do PC (`GalaxyBackdrop`, cores tiradas do tema, desligável em Aparência).
