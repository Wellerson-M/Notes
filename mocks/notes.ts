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
}

// Datas relativas a 2026-05-21
const d = (days: number, hour = 10, min = 0) => {
  const dt = new Date('2026-05-21T00:00:00')
  dt.setDate(dt.getDate() - days)
  dt.setHours(hour, min, 0, 0)
  return dt.toISOString()
}

export const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Reunião com cliente — terça',
    content: `## Reunião com cliente — terça

Alinhamento sobre o redesign do dashboard. Cliente pediu paleta mais sóbria e melhor hierarquia visual.

**Próximos passos acordados:**
- Entregar mockup revisado até sexta
- Apresentar sistema de design na próxima call
- Revisar animações com time de front

**Observações:** O cliente mencionou que o produto concorrente usa muito gradiente — diferenciação pela simplicidade é o caminho.`,
    createdAt: d(0, 9, 30),
    updatedAt: d(0, 11, 15),
    tags: ['trabalho', 'reunião', 'design'],
    pinned: false,
    inVault: false,
    attachments: {},
    tasks: [
      { text: 'Entregar mockup revisado até sexta', done: true },
      { text: 'Apresentar sistema de design na próxima call', done: true },
      { text: 'Revisar animações com time de front', done: false },
      { text: 'Enviar ata da reunião por e-mail', done: false },
    ],
  },
  {
    id: '2',
    title: null,
    content: `**OCR transcrito do quadro:**

Arquitetura microsserviços — esboço inicial

→ API Gateway → Auth Service → User Service
→ Notification Service (fila assíncrona)
→ Analytics (consumer separado)

Pontos de atenção:
- Latência entre serviços (usar gRPC internamente)
- Observabilidade: traces distribuídos desde o início
- Circuit breaker em todas as chamadas externas`,
    createdAt: d(0, 8, 10),
    updatedAt: d(0, 8, 10),
    tags: ['arquitetura', 'trabalho'],
    pinned: false,
    inVault: false,
    attachments: {
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80',
          ocrText: 'Arquitetura microsserviços — esboço inicial',
        },
      ],
    },
  },
  {
    id: '3',
    title: 'Ideias pro app de finanças — gravado caminhando',
    content: `Transcrição de áudio — 2min 14s

Pensando em como simplificar o onboarding. A maioria dos apps de finanças pede dezenas de informações logo de cara e as pessoas abandonam.

E se começássemos pedindo só UMA coisa: qual é o seu maior objetivo financeiro agora? A partir disso, personalizamos tudo. Isso reduz a fricção e aumenta o engajamento inicial.

Outra ideia: integração passiva com extrato bancário via PDF — sem precisar de open finance. O usuário tira foto do extrato e a IA categoriza automaticamente.

Preciso validar esse segundo ponto com o time de produto na quinta.`,
    createdAt: d(0, 7, 45),
    updatedAt: d(0, 7, 45),
    tags: ['ideia', 'produto', 'finanças'],
    pinned: false,
    inVault: false,
    attachments: {
      audio: {
        url: '/mock-audio.mp3',
        duration: 134,
        transcript: 'Pensando em como simplificar o onboarding...',
      },
    },
  },
  {
    id: '4',
    title: 'Pensar Rápido e Devagar — Cap. 3',
    content: `# Pensar Rápido e Devagar — Cap. 3

**Heurísticas e Vieses — Kahneman**

O capítulo 3 introduz o conceito de heurística da representatividade. Tendemos a julgar a probabilidade de algo baseando-nos em quão representativo ele é de uma categoria, ignorando taxas base.

> "A mente intuitiva não processa estatísticas. Ela processa narrativas."

**Exemplos que marcaram:**
- O caso do taxista que bateu o carro — conclusão precipitada por representatividade
- O problema de Linda (feminista ou caixa de banco?)

**Implicações para design de produto:**
- Usuários decidem por heurísticas, não por lógica
- Defaults importam mais do que qualquer texto explicativo
- Feedback imediato é mais eficaz do que relatórios detalhados

**Citação para guardar:**
> "Nothing in life is as important as you think it is, while you are thinking about it."`,
    createdAt: d(1, 21, 30),
    updatedAt: d(1, 22, 0),
    tags: ['leitura', 'psicologia', 'produto'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '5',
    title: 'Lista de mercado — domingo',
    content: `- [ ] Café (torrado e moído)
- [ ] Sabão em pó
- [ ] Fralda GG (2 pacotes)
- [ ] Pão de forma integral
- [ ] Queijo minas
- [ ] Frango (filé, ~1kg)
- [ ] Brócolis e abobrinha
- [ ] Azeite extra virgem
- [ ] Leite de amêndoas
- [ ] Chocolate 70%`,
    createdAt: d(1, 18, 0),
    updatedAt: d(1, 18, 0),
    tags: ['pessoal', 'lista'],
    pinned: false,
    inVault: false,
    attachments: {},
    tasks: [
      { text: 'Café (torrado e moído)', done: true },
      { text: 'Sabão em pó', done: true },
      { text: 'Fralda GG (2 pacotes)', done: false },
      { text: 'Pão de forma integral', done: false },
      { text: 'Queijo minas', done: false },
      { text: 'Frango (filé, ~1kg)', done: false },
    ],
  },
  {
    id: '6',
    title: 'Senhas e códigos importantes',
    content: `Conteúdo protegido pelo Vault.`,
    createdAt: d(3, 14, 0),
    updatedAt: d(0, 8, 0),
    tags: ['vault', 'privado'],
    pinned: true,
    inVault: true,
    attachments: {},
  },
  {
    id: '7',
    title: 'Local-first software',
    content: `Artigo muito relevante sobre o futuro das aplicações web. A premissa central: dados do usuário devem viver no dispositivo do usuário, não em servidores de terceiros.

Pontos principais:
- Colaboração em tempo real **sem** depender de servidor central
- Funciona offline nativamente
- Sincronização via CRDTs (Conflict-free Replicated Data Types)

**Por que isso importa pro Grafite?** Toda a proposta de valor do app depende de funcionar offline e sincronizar de forma confiável. CRDTs são a resposta natural para notas multi-dispositivo.`,
    createdAt: d(1, 15, 20),
    updatedAt: d(1, 15, 20),
    tags: ['tecnologia', 'arquitetura'],
    pinned: false,
    inVault: false,
    attachments: {
      links: [
        {
          url: 'https://www.inkandswitch.com/local-first/',
          title: 'Local-first software: You own your data, in spite of the cloud',
          description: 'A new set of principles for collaborative software that keeps your data safe, private, and durable.',
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
        },
      ],
    },
  },
  {
    id: '8',
    title: null,
    content: `Terminei o relatório Q1 antes do prazo. Finalmente.

Três semanas de dados viram 12 páginas. Agora é só aguardar o feedback do time de growth.`,
    createdAt: d(0, 16, 45),
    updatedAt: d(0, 16, 45),
    tags: ['trabalho'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '9',
    title: null,
    content: `Cafezinho com o Renato e a Ana depois do almoço. Ótimo papo sobre inteligência artificial e mercado de trabalho.

Renato acredita que em 3 anos metade das vagas júnior vão desaparecer. Ana discordou — acha que vão surgir funções novas. Fiquei no meio.

O que tenho certeza: quem souber usar IA como ferramenta vai estar muito à frente.`,
    createdAt: d(0, 14, 10),
    updatedAt: d(0, 14, 10),
    tags: ['reflexão', 'carreira'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '10',
    title: 'Receita: estrogonofe de cogumelos',
    content: `# Estrogonofe de cogumelos

**Ingredientes (4 porções):**
- 500g de cogumelo portobello ou Paris
- 1 cebola grande
- 3 dentes de alho
- 2 colheres de manteiga
- 1 xícara de creme de leite fresco
- 1 colher de molho inglês
- Ketchup, sal, pimenta a gosto
- Salsinha pra finalizar

**Modo de preparo:**
1. Refogue cebola e alho na manteiga até dourar
2. Adicione os cogumelos fatiados e cozinhe até murcharem
3. Tempere com sal, pimenta e molho inglês
4. Adicione ketchup (2 colheres), mexa
5. Baixe o fogo e adicione o creme de leite
6. Cozinhe por 3min sem ferver
7. Finalize com salsinha

Servir com arroz branco e batata palha. 🍄`,
    createdAt: d(2, 19, 30),
    updatedAt: d(2, 19, 30),
    tags: ['receita', 'culinária'],
    pinned: false,
    inVault: false,
    attachments: {
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
        },
      ],
    },
  },
  {
    id: '11',
    title: 'Mood do dia — segunda chuvosa',
    content: `Choveu o dia inteiro. Fiquei em casa trabalhando com a janela aberta, aquele cheiro de terra molhada.

Produtividade estranha — às vezes flui sem esforço, às vezes trava em uma linha de código por 40 minutos.

No final do dia, a sensação foi de que fiz o suficiente. Não sobrou energia pra academia, mas sobrou pra ler por uma hora antes de dormir.

Preciso parar de medir os dias pelo quanto produzi e começar a medir pela qualidade da presença.`,
    createdAt: d(5, 22, 15),
    updatedAt: d(5, 22, 15),
    tags: ['diário', 'reflexão'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '12',
    title: 'Revisão de código — PR #42',
    content: `## PR #42 — Refatoração do módulo de autenticação

Revisando o PR do Lucas. Pontos que preciso checar antes de aprovar:

**Questões técnicas:**
- Verificar se o refresh token tem expiração correta
- Testar o fluxo de logout em múltiplos dispositivos
- Confirmar que o middleware não adiciona latência desnecessária

**Questões de estilo:**
- Naming inconsistente em alguns métodos (camelCase vs snake_case)
- Falta de comentário explicativo no algoritmo de hash`,
    createdAt: d(2, 10, 0),
    updatedAt: d(2, 14, 30),
    tags: ['trabalho', 'código'],
    pinned: false,
    inVault: false,
    attachments: {},
    tasks: [
      { text: 'Verificar expiração do refresh token', done: true },
      { text: 'Testar logout em múltiplos dispositivos', done: false },
      { text: 'Confirmar latência do middleware', done: false },
      { text: 'Comentar algoritmo de hash', done: false },
    ],
  },
  {
    id: '13',
    title: 'Plano de estudos — TypeScript avançado',
    content: `## TypeScript avançado — roteiro de estudos

**Semana 1-2:** Tipos condicionais e infer
**Semana 3:** Template literal types
**Semana 4:** Decorators e reflect-metadata
**Semana 5:** Performance de compilação em projetos grandes

**Recursos:**
- TypeScript Handbook (oficial)
- "Effective TypeScript" — Dan Vanderkam
- Exercícios no Type Challenges (GitHub)

**Meta:** Conseguir tipar qualquer biblioteca sem depender de @types/*`,
    createdAt: d(4, 8, 0),
    updatedAt: d(4, 8, 0),
    tags: ['estudo', 'typescript', 'programação'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '14',
    title: 'Treino semana 3 — resultados',
    content: `Terceira semana de treino consecutiva. Aumentei a carga no supino e na rosca direta.

Peso atual: 78kg (meta: 82kg até agosto)`,
    createdAt: d(3, 7, 0),
    updatedAt: d(3, 7, 0),
    tags: ['saúde', 'treino'],
    pinned: false,
    inVault: false,
    attachments: {},
    tasks: [
      { text: 'Segunda — peito e tríceps', done: true },
      { text: 'Quarta — costas e bíceps', done: true },
      { text: 'Sexta — pernas', done: true },
      { text: 'Sábado — ombros e core', done: false },
    ],
  },
  {
    id: '15',
    title: 'Notas da aula de Design de UI',
    content: `## Hierarquia visual e grids

A aula de hoje foi sobre como o olho humano percorre uma tela. Dois padrões principais:

**Padrão F:** Muito comum em conteúdo textual denso. Usuário varre horizontalmente o topo, depois uma segunda linha, depois só a vertical esquerda.

**Padrão Z:** Mais comum em conteúdo visual/marketing. Olho vai de canto superior esquerdo → direito → diagonal → esquerdo embaixo → direito.

**Implicações práticas:**
- Informação mais importante sempre no topo esquerdo
- CTAs no final do caminho natural do olho
- Nunca centralize texto longo (dificulta o padrão F)

> "Design não é sobre como parece. É sobre como funciona." — Steve Jobs`,
    createdAt: d(6, 19, 0),
    updatedAt: d(6, 19, 0),
    tags: ['estudo', 'design', 'ui'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '16',
    title: 'Orçamento maio 2026',
    content: `## Controle financeiro — maio

**Renda:** R$ 7.200

**Fixos:**
- Aluguel: R$ 1.800
- Internet + celular: R$ 180
- Academia: R$ 99

**Variáveis até agora:**
- Mercado: R$ 520
- Delivery: R$ 210 (precisa controlar)
- Transporte: R$ 95

**Sobrou para objetivos:** R$ 4.296
**Meta de reserva emergência:** R$ 1.500`,
    createdAt: d(4, 12, 0),
    updatedAt: d(1, 9, 0),
    tags: ['finanças', 'pessoal'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '17',
    title: 'Ideia: app de vocabulário em idiomas',
    content: `Tive essa ideia no chuveiro (como sempre).

Um app de vocabulário que usa o contexto da sua própria vida. Em vez de flashcards genéricos, você tira foto de objetos ao redor e o app te ensina o vocabulário no idioma alvo.

**Diferencial:** aprendizado ancorado em ambiente real, não em frases fabricadas.

**Stack possível:** React Native + Vision API + GPT-4o para geração de frases contextuais.

**Validar com:** pessoas que estudam idiomas mas travam no vocabulário cotidiano.`,
    createdAt: d(5, 11, 30),
    updatedAt: d(5, 11, 30),
    tags: ['ideia', 'produto', 'educação'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '18',
    title: 'Reflexões sobre liderança',
    content: `Li um artigo hoje sobre o que diferencia líderes eficazes. A maioria das pessoas associa liderança com carisma e visão. Mas o que mais importa, segundo a pesquisa, é consistência.

Não a consistência de estilo (sempre sério, sempre animado), mas a consistência de valores — as pessoas precisam saber o que esperar de você em situações difíceis.

Isso ressoa com o que vi nos últimos meses trabalhando mais de perto com o time. O que mais geroa confiança não é uma fala motivadora. É o líder aparecendo quando prometeu, dando feedback honesto quando desconfortável, defendendo o time quando ninguém está olhando.`,
    createdAt: d(6, 20, 45),
    updatedAt: d(6, 20, 45),
    tags: ['reflexão', 'liderança', 'carreira'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
  {
    id: '19',
    title: 'Filmes pra assistir',
    content: `Lista mantida em aberto. Atualizar quando assistir.`,
    createdAt: d(7, 21, 0),
    updatedAt: d(2, 17, 0),
    tags: ['entretenimento', 'lista'],
    pinned: false,
    inVault: false,
    attachments: {},
    tasks: [
      { text: 'Past Lives (2023)', done: true },
      { text: 'A Zona de Interesse (2023)', done: true },
      { text: 'Oppenheimer', done: true },
      { text: 'Dune: Part Two', done: false },
      { text: 'The Substance (2024)', done: false },
      { text: 'Conclave (2024)', done: false },
      { text: 'Anora (2024)', done: false },
    ],
  },
  {
    id: '20',
    title: 'Stand-up de ontem',
    content: `**Feito:** finalizei a integração com a API de pagamentos e escrevi os testes unitários.

**Hoje:** revisar o PR do Pedro e começar a documentação do endpoint de webhooks.

**Bloqueios:** aguardando acesso ao ambiente de staging do cliente. Já escalei com o Bruno.`,
    createdAt: d(1, 9, 15),
    updatedAt: d(1, 9, 15),
    tags: ['trabalho', 'dev'],
    pinned: false,
    inVault: false,
    attachments: {},
  },
]

export function getRelativeDate(iso: string): string {
  const now = new Date('2026-05-21T12:00:00')
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD === 1) return 'ontem'
  if (diffD < 7) {
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
    return days[date.getDay()]
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
