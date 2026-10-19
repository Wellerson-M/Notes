'use client'
import type { LocalNote } from './types'
import { extractLinkedIds, extractTasks } from './notes'

/**
 * Modo demonstração: abre com `?demo` (é o link usado no portfólio) e vale até fechar a aba.
 * Usa outro banco local (`grafite-notas-demo`), não sincroniza e começa com notas fictícias,
 * então quem testa nunca vê nem mexe nas notas reais.
 */
export const isDemo: boolean = (() => {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).has('demo')) sessionStorage.setItem('grafite-demo', '1')
    return sessionStorage.getItem('grafite-demo') === '1'
  } catch {
    return false
  }
})()

const day = 24 * 60 * 60 * 1000

/** Data `daysAgo` dias atrás, num horário fixo para a ordem ficar estável */
function ago(daysAgo: number, hour = 9): string {
  const d = new Date(Date.now() - daysAgo * day)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function dateKey(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Seed = { id: string; title: string; content: string; tags: string[]; daysAgo: number; hour?: number; pinned?: boolean; schedule?: LocalNote['schedule'] }

const SEEDS: Seed[] = [
  {
    id: 'demo-boas-vindas',
    title: 'Modo demonstração',
    pinned: true,
    daysAgo: 0,
    hour: 8,
    tags: ['demo'],
    content: `Estas notas são **fictícias** e ficam só neste navegador. Pode editar, apagar e criar à vontade.

## Para testar
- [ ] Abrir a nota [[Ideias para o fim de semana]]
- [ ] Criar uma nota nova no botão +
- [ ] Ver o **Diário** na barra de baixo
- [ ] Arrastar um card para o lado

A sincronização e a IA ficam desligadas aqui.`,
  },
  {
    id: 'demo-mercado',
    title: 'Lista do mercado',
    daysAgo: 1,
    hour: 18,
    tags: ['casa'],
    content: `- [x] Café
- [x] Pão de forma
- [ ] Banana
- [ ] Arroz 5 kg
- [ ] Detergente
- [ ] Queijo para o fim de semana`,
  },
  {
    id: 'demo-fim-de-semana',
    title: 'Ideias para o fim de semana',
    daysAgo: 2,
    hour: 21,
    tags: ['lazer'],
    content: `Opções que surgiram na conversa de ontem:

- Trilha curta no morro, saindo cedo
- Feira de artesanato no centro (sábado de manhã)
- Testar aquela pizzaria nova, ver [[Restaurantes para testar]]

Se chover: maratona de filme e pipoca.`,
  },
  {
    id: 'demo-restaurantes',
    title: 'Restaurantes para testar',
    daysAgo: 4,
    hour: 12,
    tags: ['lazer', 'comida'],
    content: `- Pizzaria de forno a lenha perto da praça
- Rodízio japonês do shopping (dizem que a terça é mais barata)
- Café colonial na serra, para um domingo

Ligado a [[Ideias para o fim de semana]].`,
  },
  {
    id: 'demo-estudos',
    title: 'Plano de estudos da semana',
    daysAgo: 3,
    hour: 7,
    tags: ['estudo'],
    content: `## Segunda a quarta
- [x] Revisar índices e consultas em SQL
- [x] Exercícios de TypeScript (tipos genéricos)
- [ ] Ler o capítulo de testes automatizados

## Quinta e sexta
- [ ] Montar a apresentação do trabalho em grupo
- [ ] Revisar [[Resumo: algoritmos de ordenação]]`,
  },
  {
    id: 'demo-ordenacao',
    title: 'Resumo: algoritmos de ordenação',
    daysAgo: 8,
    hour: 20,
    tags: ['estudo'],
    content: `| Algoritmo | Melhor | Pior | Estável |
|---|---|---|---|
| Insertion sort | O(n) | O(n²) | sim |
| Merge sort | O(n log n) | O(n log n) | sim |
| Quick sort | O(n log n) | O(n²) | não |

> Merge sort garante O(n log n), mas usa memória extra. Quick sort costuma ser o mais rápido na prática.`,
  },
  {
    id: 'demo-reuniao',
    title: 'Reunião do trabalho em grupo',
    daysAgo: 0,
    hour: 10,
    tags: ['estudo'],
    schedule: { date: dateKey(2), time: '19:30' },
    content: `Pauta:
1. Dividir os tópicos da apresentação
2. Definir quem fala o quê
3. Ensaiar uma vez inteira

Levar o notebook carregado.`,
  },
  {
    id: 'demo-treino',
    title: 'Treino',
    daysAgo: 6,
    hour: 6,
    tags: ['saúde'],
    content: `Corrida leve de 5 km no parque. Ritmo confortável, sem dor no joelho desta vez.

Próxima meta: 6 km até o fim do mês.`,
  },
  {
    id: 'demo-livro',
    title: 'Trechos do livro',
    daysAgo: 12,
    hour: 22,
    tags: ['leitura'],
    content: `> "Primeiro resolva o problema. Depois escreva o código."

Ideia boa para levar para os projetos: entender bem o que o usuário precisa antes de abrir o editor.`,
  },
  {
    id: 'demo-viagem',
    title: 'Viagem de dezembro',
    daysAgo: 15,
    hour: 19,
    tags: ['viagem'],
    content: `- [x] Pesquisar pousadas
- [ ] Reservar até o dia 10
- [ ] Revisar o carro (pneus e óleo)
- [ ] Separar protetor solar e capa de chuva

Orçamento: hospedagem + combustível + comida, com uma folga de 15%.`,
  },
]

export function demoNotes(): LocalNote[] {
  const notes: LocalNote[] = SEEDS.map((s) => ({
    id: s.id,
    title: s.title,
    content: s.content,
    tags: s.tags,
    pinned: !!s.pinned,
    inVault: false,
    attachments: {},
    tasks: extractTasks(s.content),
    schedule: s.schedule,
    createdAt: ago(s.daysAgo, s.hour),
    updatedAt: ago(s.daysAgo, s.hour),
    dirty: 0,
  }))
  return notes.map((n) => ({ ...n, linkedNoteIds: extractLinkedIds(n.content, notes) }))
}
