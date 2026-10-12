# Grafite Notas — Estado e próximos passos

> Última atualização: **12/10/2026**. Escrito para você (ou uma IA) retomar daqui a semanas sem reler o código.
> Detalhes técnicos em [ARQUITETURA.md](ARQUITETURA.md) · configuração em [DEPLOY.md](DEPLOY.md) · testes em [TESTES.md](TESTES.md).

## Se você só tem 5 minutos

1. O app **está completo para uso pessoal**: notas salvas no aparelho, offline, sync entre aparelhos, IA, voz, Vault cifrado, histórico de versões, foto → texto e busca por sentido.
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
| Diário + heatmap + **resumo da semana** pela IA | ✅ |
| Busca: texto, tags, datas e **por sentido** (embeddings do Gemini, no aparelho) | ✅ |
| IA no editor (sugestões, resumir, tarefas, expandir, traduzir, corrigir, tópicos) | ✅ precisa de `GEMINI_API_KEY`; cai para o modelo leve se o principal sobrecarregar |
| **Foto → texto** (OCR pelo Gemini; a foto não é guardada) | ✅ |
| Assistente conversacional (texto e voz, propõe criar, acrescentar e abrir nota) | ✅ precisa de `GEMINI_API_KEY` |
| Ditado por voz (Web Speech API) | ✅ Chrome, Edge e Safari; não funciona no Firefox |
| Atualização automática do app instalado | ✅ |
| Layout PC (coluna central) | ✅ |
| **Vault cifrado** (AES-GCM no aparelho, senha própria, biometria opcional, tranca sozinho) | ✅ o Atlas só vê o cifrado |
| **Histórico de versões** (a cada 10 min de edição e em todo conflito de sync) | ✅ só no aparelho; menu da nota → Versões anteriores |
| Backup completo (.json, Vault cifrado) e exportação em Markdown (.zip) | ✅ |
| **Compartilhar para o app** (share target) e atalhos no ícone | ✅ Android; o iPhone não suporta share target em PWA |
| Teste ponta a ponta (`npm run e2e`, 76 verificações, celular e PC, IA real) | ✅ |
| Merge automático de conflito (juntar as duas edições) | ❌ hoje a perdedora vai para o histórico |
| Guardar a foto junto da nota | ❌ só o texto extraído |

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
| D8 | Vault: senha própria → PBKDF2 (310 mil iterações) → AES-GCM 256; chave só na memória | O servidor nunca vê o texto. Esquecer a senha = perder as notas do Vault |
| D9 | Biometria = WebAuthn guardando a chave (CryptoKey não extraível) no IndexedDB | Conveniência por aparelho; protege de quem pega o celular, não de quem tem acesso ao navegador desbloqueado com ferramentas de desenvolvedor |
| D10 | Histórico de versões só no aparelho | Sem custo de armazenamento no Atlas M0 |
| D11 | Busca por sentido com vetores de 256 dimensões, comparados no aparelho | Grátis, rápido e funciona com centenas de notas; só o texto vai ao Gemini, uma vez por edição |

## Próximos passos (em ordem)

### 1. Colocar no ar
Cadastrar `MONGODB_URI`, `APP_PASSWORD` e `GEMINI_API_KEY` na Vercel e fazer o deploy (ver DEPLOY.md).
**Pronto quando:** `/api/auth` em produção mostra `"configured": true, "ai": true`.

### 2. Roteiro manual no celular
Fazer o "Roteiro manual" de [TESTES.md](TESTES.md) no aparelho real (voz, instalação, gestos, biometria, câmera, compartilhar).
**Pronto quando:** os 12 passos funcionarem; anotar aqui o que falhar.

### 3. Ícone novo
Gerar o logo (há um prompt pronto na conversa de 12/10) e trocar `public/icons/icon-192.svg` e `icon-512.svg`. Vale exportar também PNGs 192/512, porque alguns Androids ignoram SVG no manifest.

### 4. Lembretes (opcional)
Data em tarefas (`- [ ] ligar @amanhã 9h`) e notificação. Sem servidor de push, só funciona com o app aberto ou via Notification Triggers (pouco suporte). Com push: Web Push + VAPID + um cron na Vercel.

### 5. Merge de conflito (opcional)
Hoje, quando dois aparelhos editam a mesma nota offline, a versão mais nova vence e a outra vai para o histórico. Dá para juntar automaticamente com um diff de linhas (ex.: `diff-match-patch`).

### Pequenas pendências
- Avisos de lint: `<img>` no `NoteCard.tsx` (miniaturas de foto herdadas do protótipo; nenhuma nota tem foto hoje).
- O avatar "W" no topo é fixo.
- A busca por sentido não reindexa sozinha: as notas novas ou editadas são indexadas na próxima busca.
- **Higiene do Git:** a pasta `Notes/` (acima deste repositório) é outro repositório git vazio, aninhado, com um `atlas-credentials (1).env` solto. Dá para apagar o `.git` de `Notes/` e guardar o arquivo de credenciais num gerenciador de senhas.

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
- **12/10/2026 (4)** — Voz: corrigida a repetição de frases no Android (modo contínuo do Chrome); no assistente, envia sozinho 1,2s depois de você parar de falar. IA mais rápida: o Flash-Lite (~1,5s) virou o modelo principal, e o Flash (que "pensa", 5–30s, cota diária pequena) virou reserva. Teste `npm run e2e:voz`.
- **12/10/2026 (3)** — Deslizar dos cards refeito: segue o dedo 1:1 (antes travava em 80px e a transição CSS do `touch-feedback` brigava com o arraste), fundo e ícone acompanham o dedo, vibração ao passar do ponto, peteleco, o card sai da tela ao apagar e um arraste nunca abre a nota sem querer. A IA pede a senha ali mesmo quando o aparelho não está conectado. Teste `npm run e2e:gestos`.
- **12/10/2026 (2)** — Vault cifrado de verdade (senha, biometria, auto-trancar; IA bloqueada), histórico de versões (inclusive em conflito — e correção no sync, que limpava a marca de "sujo" antes de comparar com o servidor), foto → texto, busca por sentido, resumo da semana, compartilhar para o app e atalhos, backup completo e exportação em Markdown, reserva automática quando o Gemini sobrecarrega, lint sem erros e e2e com IA real (76/76).
- **12/10/2026** — O app virou de verdade: Dexie local-first, sync com MongoDB Atlas, login por senha, service worker offline, IA com Gemini (ações no editor, sugestões, assistente por voz), ditado real, busca por tags e datas, swipe para fixar ou apagar com desfazer, atualização automática do PWA, layout de PC, wikilinks clicáveis, teste ponta a ponta (46/46 em celular e PC) e documentação reorganizada em `docs/`.
