# Deploy e configuração

> Tudo nos planos gratuitos. Produção atual: https://notes-ten-tau-15.vercel.app/

## 1. MongoDB Atlas (banco)

1. Em https://cloud.mongodb.com, crie um cluster **M0 (Free)**.
2. **Database Access:** crie um usuário com senha (permissão *Read and write to any database*).
3. **Network Access → Add IP Address → `0.0.0.0/0`** (*Allow access from anywhere*). **Obrigatório para a Vercel**, que não tem IP fixo. A segurança fica por conta do usuário e da senha do banco.
4. **Connect → Drivers:** copie a string `mongodb+srv://...`. Ela vai em `MONGODB_URI`.

O banco (`grafite-notas`) e a coleção (`notes`) são criados sozinhos no primeiro sync.

## 2. Google Gemini (IA)

1. Entre em https://aistudio.google.com/apikey com uma conta Google.
2. **Create API key** (não pede cartão). A chave vai em `GEMINI_API_KEY`.

Limites do plano gratuito: dá de sobra para uso pessoal. Se estourar, o app mostra "Limite gratuito da IA atingido por agora" e volta a funcionar alguns minutos depois.

## 3. Vercel (hospedagem)

1. Em https://vercel.com, use **Add New → Project** e importe o repositório `Wellerson-M/Notes`. O framework é detectado como Next.js; não mexa no build.
2. **Settings → Environment Variables** (marque Production, Preview e Development):

   | Nome | Valor |
   |---|---|
   | `MONGODB_URI` | string do Atlas |
   | `APP_PASSWORD` | a senha que você vai digitar em cada aparelho |
   | `GEMINI_API_KEY` | chave do AI Studio |

3. **Deploy.** Depois de mudar variáveis, é preciso fazer **Redeploy** (Deployments → ⋯ → Redeploy).

Cada `git push` na branch principal gera um deploy novo, e os aparelhos se atualizam sozinhos (ver ARQUITETURA → Atualização automática).

## 4. Instalar no celular

- **Android (Chrome):** abra o site → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** botão compartilhar → **Adicionar à Tela de Início**.
- Depois, em **Ajustes → Sincronização**, digite a `APP_PASSWORD`.

## 5. Conferindo se está tudo certo

Abra `https://<seu-app>/api/auth` no navegador:

```json
{"authenticated": false, "configured": true, "ai": true}
```

- `configured: false` → falta `MONGODB_URI` ou `APP_PASSWORD` na Vercel (e o Redeploy).
- `ai: false` → falta `GEMINI_API_KEY`.

E `https://<seu-app>/api/version` mostra qual commit está no ar.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Ponto vermelho no topo, "erro ao sincronizar" | Atlas recusando a conexão | Network Access com `0.0.0.0/0`; conferir usuário e senha na URI |
| "não conectado" em Ajustes | Aparelho sem login | Digitar a senha em Ajustes |
| Todos os aparelhos deslogaram | `APP_PASSWORD` foi trocada | Entrar de novo com a senha nova (é o comportamento esperado) |
| "A IA ainda não foi configurada" | Falta `GEMINI_API_KEY` | Cadastrar e fazer Redeploy |
| Ditado não funciona | Firefox, http sem TLS ou microfone negado | Usar Chrome/Edge/Safari em https e permitir o microfone |
| App instalado mostra versão velha | Ainda não percebeu o deploy | Sair e voltar para o app, ou **Ajustes → Procurar atualização** |
| Páginas novas dão 404 em produção | O código não foi enviado (push) | `git push` e esperar o deploy terminar |

## Rodando local com a mesma configuração

```bash
cp .env.example .env.local   # e preencha
npm run build && npm run start
```

Para testar no celular pela rede local (`http://192.168.x.x:3000`), lembre que **ditado e instalação exigem HTTPS**. Use o deploy da Vercel para isso.
