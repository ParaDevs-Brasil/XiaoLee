# Referencia da API (FastAPI)

Este documento mapeia todas as rotas expostas pela camada Backend da XiaoLee.

## Base URL

| Ambiente   | URL                          |
|------------|------------------------------|
| Local      | `http://localhost:8000`      |
| Docker     | `http://xiaolee-core:8000`   |
| Docs       | `http://localhost:8000/docs` |

---

## Saude e Status

### `GET /health`

Verifica a conectividade com o banco de dados (SQLite) e com o RPC da Solana (Devnet).

**Resposta (200 OK):**
```json
{
  "status": "ok",
  "service": "XiaoLee Core API",
  "version": "2.0.0-mvp",
  "environment": "dev",
  "solana_cluster": "devnet",
  "rpc_health": { "jsonrpc": "2.0", "result": "ok", "id": 1 },
  "gemini_enabled": false
}
```

### `GET /status`

```json
{ "status": "running" }
```

---

## Usuarios

### `GET /user/{user_id}`

Retorna dados de um usuario pelo ID (session token ou twitter_user_id).

**Resposta (200 OK):**
```json
{
  "id": "abc123",
  "username": "user_abc123",
  "platform": null,
  "swap_count": 0,
  "total_volume": 0.0,
  "campaigns_joined": [1, 2],
  "dossier": { "id": "abc123", "username": "user_abc123" }
}
```

---

## Campanhas

### `GET /campaigns`

Lista todas as campanhas ativas.

**Resposta (200 OK):**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": 1,
      "name": "XiaoLee Genesis Campaign",
      "description": "...",
      "campaign_type": "social",
      "completed_participants": 0,
      "created_at": "2026-04-21T00:00:00Z",
      "creator_twitter_user_id": "XiaoLeeProtocol",
      "max_participants": 1000,
      "profile_to_follow": "XiaoLeeProtocol",
      "reward_per_participant": 50,
      "reward_pool": 50000,
      "reward_token": "$XLEE",
      "status": "active",
      "tweet_id_to_engage": null
    }
  ]
}
```

### `GET /campaigns/user`

Retorna as campanhas em que o usuario autenticado participa.

**Header:** `Authorization: Bearer {session_id}`

**Resposta (200 OK):**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": 1,
      "name": "XiaoLee Genesis Campaign",
      "campaign_type": "social",
      "reward_token": "$XLEE",
      "reward_per_participant": 50,
      "participation_status": "enrolled",
      "status": "enrolled",
      "tasks_verified_at": null,
      "tasks_claimed": false
    }
  ]
}
```

### `POST /campaigns/join`

Registra a participacao do usuario em uma campanha.

**Header:** `Authorization: Bearer {session_id}`

**Payload:**
```json
{ "campaign_identifier": "1" }
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "Successfully joined 'XiaoLee Genesis Campaign'! Complete the tasks to earn 50 $XLEE."
}
```

### `POST /campaigns/verify`

Verifica as tarefas completadas pelo usuario.

**Header:** `Authorization: Bearer {session_id}`

**Payload:**
```json
{ "campaign_identifier": "1" }
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "All tasks verified successfully! You are eligible to claim your reward.",
  "all_tasks_completed": true
}
```

### `POST /campaigns/claim`

Reivindica a recompensa de uma campanha verificada.

**Header:** `Authorization: Bearer {session_id}`

**Payload:**
```json
{ "campaign_identifier": "1" }
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "50 $XLEE claimed successfully!",
  "transaction_id": "a1b2c3d4e5f6g7h8",
  "reward_amount": 50,
  "reward_token": "$XLEE"
}
```

### `POST /campaigns/create`

Cria uma nova campanha (requer autenticacao).

**Header:** `Authorization: Bearer {session_id}`

**Payload:**
```json
{
  "title": "Nova Campanha",
  "description": "Descricao da campanha",
  "campaign_type": "social",
  "profile_to_follow": "XiaoLeeProtocol",
  "tweet_id_to_engage": null,
  "reward_token": "$XLEE",
  "reward_per_participant": 100,
  "max_participants": 500
}
```

---

## Bate-Papo & NLP (Gemini)

### `POST /v1/messages/inbound`

Rota principal de orquestracao. Envia uma mensagem e recebe a resposta do agente Gemini com memoria de contexto.

**Payload:**
```json
{
  "user_id": "twitter_12345",
  "platform": "x",
  "text": "Quero saber o preco do $XLEE"
}
```

**Resposta (200 OK):**
```json
{
  "platform": "x",
  "user_id": "twitter_12345",
  "intent": "INFO",
  "reply_text": "O preco atual do $XLEE e...",
  "execution": null
}
```

---

## Webhooks de Redes Sociais

### `POST /v1/integrations/telegram/webhook`

Recebe o trafego oficial do Telegram Bot API.

**Header:** `X-Telegram-Bot-Api-Secret-Token: {secret}`

**Payload:** Padrao Telegram Update Object.

### `POST /v1/integrations/x/webhook`

Recebe o trafego oficial do X/Twitter Account Activity API.

**Header:** `X-Xiaolee-Signature: {hmac_sha256}`

---

## Solana & Helius

### `POST /v1/solana/webhooks/helius`

Webhook critico chamado pela Helius quando ocorre uma transacao on-chain relevante.

**Seguranca:** Exige validacao HMAC via `HELIUS_WEBHOOK_SECRET` no `.env`.

**Acao:** Processa o evento e aciona `record_swap(volume_usdc)` no contrato Anchor.

### `POST /v1/solana/swap/prepare`

Prepara uma transacao de swap via Jupiter sem executar.

**Payload:**
```json
{
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "848Nf9WswGodWrrw61dWMtuBaEcJWm9wsuBS3P5m78J4",
  "amount_raw": 100000000,
  "slippage_bps": 50,
  "user_public_key": "..."
}
```

**Resposta (200 OK):**
```json
{
  "cluster": "devnet",
  "quote": { ... },
  "swap_transaction_base64": "...",
  "last_valid_block_height": 12345678,
  "disclaimer": "Transacao somente preparada. Assine na wallet e confirme antes do envio."
}
```

---

## Autenticacao

| Rota                           | Autenticacao                              |
|-------------------------------|-------------------------------------------|
| `GET /health`, `GET /status`  | Nenhuma                                   |
| `GET /campaigns`              | Nenhuma                                   |
| `GET /user/{id}`              | Nenhuma                                   |
| `POST /campaigns/*`           | `Authorization: Bearer {session_id}`      |
| `POST /v1/integrations/*`     | Header de segredo especifico da plataforma|
| `POST /v1/solana/webhooks/*`  | HMAC Helius                               |

---

## Codigos de Erro

| Codigo | Significado                            |
|--------|----------------------------------------|
| 400    | Payload invalido ou parametros ausentes|
| 401    | Token de autorizacao ausente ou invalido|
| 404    | Recurso nao encontrado                 |
| 422    | Erro de validacao do schema Pydantic   |
| 429    | Rate limit excedido (1 req/min por user)|
| 503    | Solana RPC indisponivel                |
