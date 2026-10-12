@AGENTS.md

# Grafite Notas

App de notas pessoal, mobile-first (PWA), em português. Usuário único em vários aparelhos.
Produção: https://notes-ten-tau-15.vercel.app/

**Antes de mudar algo, leia `docs/ROADMAP.md` (estado e próximos passos) e `docs/ARQUITETURA.md`.**

## Arquitetura em uma frase

Local-first: o IndexedDB (Dexie) é a fonte da verdade no aparelho; `lib/sync.ts` sincroniza com o
MongoDB Atlas via `/api/sync` ("última escrita vence" por `updatedAt`); a IA (Gemini, plano grátis)
roda só no servidor em `/api/ai`.

## Regras

- Telas nunca falam com o Dexie direto: use `notesRepo` e `useNotes`/`useNote` de `lib/repo.ts`.
- Exclusão é lógica (`deleted: true`), senão o sync não propaga para outros aparelhos.
- Links de nota: sempre `noteHref(id)` / `newNoteHref(mode)` de `lib/routes.ts` (rota `/note?id=`, estática por causa do offline).
- Notas com `inVault: true` são gravadas cifradas (`cipher`, ver `lib/vault.ts`) e nunca vão para a IA (`buildDigests` filtra; o editor bloqueia).
- Dentro de `db.transaction` do Dexie, não espere promessas de fora (Web Crypto, fetch): a transação fecha sozinha.
- Elemento `position: fixed` novo precisa da classe `.app-bar` ou `.app-fab` (coluna central no PC).
- Página nova: adicionar em `PAGES` de `public/sw.js` para abrir offline.
- Cores só via variáveis CSS de `app/globals.css`; animações ≤ 400ms; respeitar "Reduzir movimento" (ver `docs/DESIGN.md`).
- Textos da interface em português do Brasil, com acentos.

## Comandos

```bash
npm run dev       # http://localhost:3000 (service worker desligado no dev)
npm run build     # precisa passar antes de commit
npm run lint      # sem erros (2 avisos de <img> no NoteCard)
npm run e2e       # teste ponta a ponta; ver docs/TESTES.md
```

Variáveis de ambiente: veja `.env.example` (`MONGODB_URI`, `APP_PASSWORD`, `GEMINI_API_KEY`).
