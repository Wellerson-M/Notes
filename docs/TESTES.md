# Testes

## Checagens rápidas (sempre antes de commitar)

```bash
npx tsc --noEmit          # tipos
npm run lint              # sem erros (2 avisos de <img> no NoteCard)
npm run build             # precisa passar
```

## Teste ponta a ponta automatizado

`scripts/e2e.cjs` abre um **Chrome de verdade** (via `playwright-core`) e roda os fluxos principais duas vezes: em perfil **celular** (390px, touch) e **PC** (1366px). São 76 verificações (38 por perfil):

- login (senha errada e certa)
- criar nota pelo botão +, com título, tarefa, tag e `[[wikilink]]`
- a nota aparece na timeline e **continua lá depois de F5**
- backlink "Mencionada em" e clique no wikilink
- fixar pelo menu; **IA de verdade**: resumir, **foto → texto** (uma imagem gerada com texto conhecido), resumo da semana, **busca por sentido** ("bebida quente" acha a nota do café) e assistente
- folha de "Versões anteriores"
- **Vault:** pede para criar a senha; cria; a nota movida **fica cifrada no IndexedDB** (`cipher` começa com `gv1.` e o texto não aparece); trancar esconde; senha errada recusa; senha certa abre; IA bloqueada; apagar e **desfazer**; tirar do Vault
- **compartilhar de outro app** (`/note?title=&text=&url=`) cria a nota sozinho
- exportar em Markdown baixa um `.zip` válido
- **offline:** abre a timeline e uma nota sem rede
- nenhum erro de JavaScript no console

```bash
npm run build
npx next start -p 3123                       # terminal 1
E2E_PASSWORD=<sua APP_PASSWORD> npm run e2e  # terminal 2 (PowerShell: $env:E2E_PASSWORD="..."; npm run e2e)
```

- Capturas de cada etapa vão para `.e2e/` (fora do git).
- Usa o Atlas do `.env.local`: as notas de teste são apagadas no fim, mas ficam no banco como exclusões lógicas.
- Em outro sistema, aponte `CHROME_PATH` para o executável do Chrome. Para testar a produção: `E2E_BASE=https://notes-ten-tau-15.vercel.app`.
- Com `GEMINI_API_KEY`, a IA é chamada de verdade (gasta um pouco da cota grátis). Se o Google estiver sobrecarregado ou a cota acabar, as verificações de IA aceitam o aviso amigável.
- O Vault de teste (senha aleatória) existe só no navegador do teste. A nota cifrada passa pelo Atlas e é apagada no fim.
- Se o teste quebrar no meio, sobra nota de teste no Atlas (título "Nota celular 1234567"). Ela aparece nos seus aparelhos e pode ser apagada normalmente.
- Em falha, a tela do momento vai para `.e2e/<perfil>-ERRO.png`.

## Teste dos gestos (`npm run e2e:gestos`)

`scripts/e2e-gestos.cjs` testa o deslizar dos cards com o mouse: o card segue o dedo 1:1, um arraste curto ou lento volta sem apagar nem abrir a nota, deslizar à direita fixa, movimento vertical não arrasta, um peteleco (≥ 56px em até 300ms) apaga, desfazer devolve e o toque abre. Também testa o login com a senha **direto na folha da IA**. O sync é simulado: nada vai para o Atlas. Usa o mesmo servidor e `E2E_PASSWORD` do teste acima.

## Roteiro manual no celular (depois de cada deploy importante)

O que o teste automático não alcança: voz, instalação, gestos de toque, câmera, biometria e o "compartilhar" do sistema.

1. **Instalar** o app pela tela inicial e abrir. Deve aparecer a splash, depois a timeline.
2. **Ajustes → Sincronização:** entrar com a senha. O status deve mudar para "sincronizado".
3. **Segurar o +** → Ditar → falar uma frase → "Parar e inserir". O texto deve aparecer na nota.
4. No editor, **IA → Sugestões**: tocar numa tag sugerida e numa ideia.
5. **✨ Assistente:** tocar no microfone e dizer "anota: comprar pão amanhã" → **Criar**.
6. **Arrastar um card** para a direita (fixa) e para a esquerda (apaga) → **desfazer**.
7. **Modo avião:** abrir o app, criar uma nota, tirar do modo avião. A nota deve chegar no PC.
8. **Outro aparelho/PC:** editar a mesma nota; voltar ao celular e puxar a lista para baixo.
9. **Atualização:** fazer um deploy, sair e voltar para o app. Deve aparecer "App atualizado ✓".
10. **Vault:** criar a senha, ligar a biometria, sair do app por mais de 1 minuto e voltar. Deve pedir a digital/rosto.
11. **Foto:** no editor, tocar em "foto", fotografar um papel escrito → "Inserir no fim".
12. **Compartilhar:** no navegador ou YouTube, compartilhar um link → escolher "Notas". Deve abrir uma nota já salva com o link.
