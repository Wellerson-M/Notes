# Testes

## Checagens rápidas (sempre antes de commitar)

```bash
npx tsc --noEmit          # tipos
npm run lint              # 1 erro conhecido: app/page.tsx (setState em effect, inofensivo)
npm run build             # precisa passar
```

## Teste ponta a ponta automatizado

`scripts/e2e.cjs` abre um **Chrome de verdade** (via `playwright-core`) e roda os fluxos principais duas vezes: em perfil **celular** (390px, touch) e **PC** (1366px). São 46 verificações:

- login (senha errada e certa)
- criar nota pelo botão +, com título, tarefa, tag e `[[wikilink]]`
- a nota aparece na timeline e **continua lá depois de F5**
- backlink "Mencionada em" e clique no wikilink
- fixar pelo menu; IA sem chave mostra aviso amigável
- diário, busca por texto, aba de tags e assistente
- mover para o Vault (some da timeline, aparece no cofre)
- apagar e **desfazer**
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
- A IA não é testada com respostas reais, porque depende de chave e cota. O teste cobre o caminho de erro.

## Roteiro manual no celular (depois de cada deploy importante)

O que o teste automático não alcança: voz, instalação, gestos de toque e a IA de verdade.

1. **Instalar** o app pela tela inicial e abrir. Deve aparecer a splash, depois a timeline.
2. **Ajustes → Sincronização:** entrar com a senha. O status deve mudar para "sincronizado".
3. **Segurar o +** → Ditar → falar uma frase → "Parar e inserir". O texto deve aparecer na nota.
4. No editor, **IA → Sugestões**: tocar numa tag sugerida e numa ideia.
5. **✨ Assistente:** tocar no microfone e dizer "anota: comprar pão amanhã" → **Criar**.
6. **Arrastar um card** para a direita (fixa) e para a esquerda (apaga) → **desfazer**.
7. **Modo avião:** abrir o app, criar uma nota, tirar do modo avião. A nota deve chegar no PC.
8. **Outro aparelho/PC:** editar a mesma nota; voltar ao celular e puxar a lista para baixo.
9. **Atualização:** fazer um deploy, sair e voltar para o app. Deve aparecer "App atualizado ✓".
