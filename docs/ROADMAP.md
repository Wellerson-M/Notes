# Grafite Notas — Estado e próximos passos

> Última atualização: **12/10/2026**. Escrito para você (ou uma IA) retomar daqui a semanas sem reler o código.
> Detalhes técnicos em [ARQUITETURA.md](ARQUITETURA.md) · configuração em [DEPLOY.md](DEPLOY.md) · testes em [TESTES.md](TESTES.md).

## Se você só tem 5 minutos

1. O app **está completo para uso pessoal**: notas salvas no aparelho, offline, sync entre aparelhos, IA e voz.
2. Para continuar, siga a seção **"Próximos passos"** de cima para baixo. Cada item tem um critério de "pronto".
3. Antes de qualquer commit: `npm run build`. Antes de um deploy importante: `npm run e2e` (ver TESTES.md).

## Estado atual

| Área | Estado |
|---|---|
| Notas (criar, editar, apagar com desfazer, fixar, tags, tarefas, templates) | ✅ |
| Persistência local (IndexedDB/Dexie) | ✅ |
| Offline (service worker) | ✅ abre o app e qualquer nota sem rede |
| Sync entre aparelhos (MongoDB Atlas, "última escrita vence") | ✅ |
| Login (senha única por `APP_PASSWORD`) | ✅ |
| Wikilinks `[[ ]]`, backlinks, "conectar todas", mapa de conexões | ✅ |
| Diário + heatmap, busca (texto, tags, datas) | ✅ |
| IA no editor (sugestões, resumir, tarefas, expandir, traduzir, corrigir, tópicos) | ✅ precisa de `GEMINI_API_KEY` |
| Assistente conversacional (texto e voz, propõe criar, acrescentar e abrir nota) | ✅ precisa de `GEMINI_API_KEY` |
| Ditado por voz (Web Speech API) | ✅ Chrome, Edge e Safari; não funciona no Firefox |
| Atualização automática do app instalado | ✅ |
| Layout PC (coluna central) | ✅ |
| Teste ponta a ponta (`npm run e2e`, 46 verificações, celular e PC) | ✅ |
| **Vault protegido de verdade** | ❌ é só um botão "biometria"; o conteúdo não é criptografado |
| Foto / OCR | ❌ não existe (o botão saiu da barra do editor) |
| Histórico de versões / merge de conflito | ❌ |

## Decisões já tomadas

| # | Decisão | Por quê |
|---|---|---|
| D1 | Usuário único, vários aparelhos, login por senha | Sem cadastro e sem custo; trocar a senha desloga tudo |
| D2 | Local-first: Dexie no aparelho + MongoDB Atlas M0 | Funciona offline; o Atlas é grátis |
| D3 | Sem shadcn/ui; estilo inline com tokens CSS | Manter os componentes que já existiam |
| D4 | Nome visível "Notas" (manifest e título) | Discrição; o repositório e os docs chamam "Grafite Notas" |
| D5 | IA = Google Gemini, plano gratuito, só no servidor | Sem custo; o Vault nunca é enviado |
| D6 | Hospedagem Vercel Hobby | Grátis, deploy a cada push |
| D7 | Rota `/note?id=` (estática) em vez de `/note/[id]` | Offline para qualquer nota |

## Próximos passos (em ordem)

### 1. Configurar a IA em produção
Gerar a chave em https://aistudio.google.com/apikey e cadastrar `GEMINI_API_KEY` na Vercel (ver DEPLOY.md).
**Pronto quando:** `/api/auth` em produção mostra `"ai": true` e o assistente responde no celular.

### 2. Roteiro manual no celular
Fazer o roteiro da seção "Roteiro manual" de [TESTES.md](TESTES.md) no aparelho real (voz, instalação, gestos).
**Pronto quando:** os 9 passos funcionarem; anotar aqui o que falhar.

### 3. Vault de verdade
- Destravar com **WebAuthn** (biometria/PIN do aparelho), no lugar do botão atual.
- **Criptografar** `content`/`title` das notas do Vault no aparelho (Web Crypto, AES-GCM com chave derivada de uma senha do Vault) **antes** de sincronizar. Assim o Atlas nunca vê o texto.
- Trancar sozinho depois de X minutos em segundo plano.

**Pronto quando:** abrindo o documento no Atlas, o conteúdo de uma nota do Vault aparece cifrado; e o Vault pede biometria ao abrir.

### 4. Histórico de versões (proteção contra conflito)
Antes de sobrescrever uma nota no sync, guardar a versão perdida (tabela `history` no Dexie e/ou coleção `notes_history` no Atlas). Em Ajustes ou no menu da nota: "versões anteriores".
**Pronto quando:** editar a mesma nota offline em dois aparelhos e conseguir recuperar as duas versões.

### 5. Foto e OCR
Botão de foto de volta na barra do editor: tirar ou escolher uma imagem, comprimir no aparelho e mandar ao Gemini (que lê imagens) para extrair o texto. Guardar a imagem exige armazenamento: começar só com o **texto extraído**, sem salvar a foto.
**Pronto quando:** fotografar um quadro e o texto virar uma nota.

### 6. IA mais esperta (opcional)
- Busca semântica de verdade: embeddings gratuitos do Gemini (conferir o modelo atual na documentação), guardados no Dexie e comparados no aparelho.
- Resumo diário ou semanal no diário ("o que você anotou esta semana").
- Ações rápidas configuráveis em Ajustes.

### Pequenas pendências
- Lint: 1 erro conhecido em `app/page.tsx:63` (`setState` em effect para a onda de tinta da nota nova). É inofensivo; resolver migrando para `useSyncExternalStore` ou passando o id pela URL.
- Avisos de lint antigos: variáveis sem uso em `NeighborhoodMap.tsx` e `NoteCard.tsx`, e `<img>` no `NoteCard.tsx`.
- Filtros "Com áudio" e "Com foto" da timeline nunca encontram nada (esses anexos não existem ainda).
- O avatar "W" no topo é fixo.
- **Higiene do Git:** a pasta `Notes/` (acima deste repositório) é outro repositório git vazio, aninhado. As specs já foram copiadas para `docs/spec/`; dá para apagar o `.git` de `Notes/` com segurança.

## Como retomar (checklist)

- [ ] `npm install && npm run dev` e abrir em 380px de largura (DevTools → modo dispositivo).
- [ ] Ler esta página e a [ARQUITETURA.md](ARQUITETURA.md).
- [ ] Conferir a produção: `/api/auth` (configuração) e `/api/version` (commit no ar).
- [ ] Pegar o próximo item de "Próximos passos".
- [ ] Antes do commit: `npm run build`. Antes do deploy: `npm run e2e`.
- [ ] Atualizar esta página (estado, próximos passos e histórico).

## Histórico

- **21/05/2026** — Fase 1: frontend visual completo com dados mockados (7 telas, 22 componentes, os 5 efeitos visuais, PWA instalável). Nada persistia.
- **04/10/2026** — Retomada: campo de partículas ligado, splash screen, estados vazios unificados. Primeiro ROADMAP.
- **12/10/2026** — O app virou de verdade: Dexie local-first, sync com MongoDB Atlas, login por senha, service worker offline, IA com Gemini (ações no editor, sugestões, assistente por voz), ditado real, busca por tags e datas, swipe para fixar ou apagar com desfazer, atualização automática do PWA, layout de PC, wikilinks clicáveis, teste ponta a ponta (46/46 em celular e PC) e documentação reorganizada em `docs/`.
