# XiaoLee API Reference

Base URL local: `http://localhost:8000`

Todas as respostas são JSON.

Atualizacao documental: **2026-04-23**.

## 1. Status e Diagnóstico

### `GET /health`

Health check básico.

Resposta típica:

```json
{
  "status": "ok",
  "service": "XiaoLee Core API",
  "version": "2.0.0-mvp",
  "environment": "dev",
  "solana_cluster": "devnet",
  "rpc_health": { "jsonrpc": "2.0", "result": "ok", "id": 1 },
  "gemini_enabled": true
}
```

Retorna `503` se o RPC da Solana não responder.

Exemplo de resposta:

```json
{
  "status": "ok"
}
```

### `GET /status`

Status resumido do backend e integrações.

Resposta:

```json
{ "status": "running" }
```

### `GET /metrics`

Endpoint Prometheus text format com contadores e latência média por rota.

Exemplo de resposta:

```text
# HELP xiaolee_http_requests_total Total de requests HTTP processadas.
# TYPE xiaolee_http_requests_total counter
xiaolee_http_requests_total{method="GET",path="/status",status="200"} 1

# HELP xiaolee_http_request_duration_seconds_avg Tempo medio de resposta por rota.
# TYPE xiaolee_http_request_duration_seconds_avg gauge
xiaolee_http_request_duration_seconds_avg{method="GET",path="/status"} 0.001234
```

## 2. Chat e Orquestração

### `POST /chat`

Endpoint simplificado para interação textual.

Request típico:

```json
{
  "message": "swap 0.1 SOL para USDC",
  "platform": "web",
  "user_id": "web-user-123"
}
```

Resposta típica:

```json
{
  "response": [{ "type": "text", "content": "..." }],
  "intent": { "action": "swap", "confidence": 0.98, "entities": {} },
  "execution": {},
  "code": null,
  "animations": null
}
```

### `POST /v1/messages/inbound`

Entrada principal para mensagens normalizadas de canais.

Schema principal: `platform`, `user_id`, `text` e `metadata` opcional.

Exemplo de request:

```json
{
  "platform": "telegram",
  "user_id": "123456",
  "text": "swap 0.1 SOL para USDC"
}
```

Exemplo de resposta:

```json
{
  "platform": "telegram",
  "user_id": "123456",
  "intent": { "action": "swap", "confidence": 0.98, "entities": {} },
  "reply_text": "Posso preparar a transacao para voce.",
  "execution": {}
}
```

## 3. Webhooks de Integração

### `POST /v1/integrations/telegram/webhook`

Webhook Telegram.

Segurança:

- Header `X-Telegram-Bot-Api-Secret-Token` deve corresponder ao valor configurado.

### `POST /v1/integrations/x/webhook`

Webhook X/Twitter.

Segurança:

- Assinatura HMAC validada no backend.

### `POST /v1/solana/webhooks/helius`

Recebe eventos on-chain de confirmação/falha.

Segurança:

- Header `Authorization` deve bater com `HELIUS_WEBHOOK_SECRET`.

Resposta de sucesso:

```json
{ "status": "success", "processed_events": 1 }
```

## 4. Solana Swap

### `POST /v1/solana/swap/prepare`

Prepara a transação de swap sem assinatura (wallet-first).

Request esperado:

- `user_public_key`
- `input_mint`
- `output_mint`
- `amount_raw`
- `slippage_bps`

Exemplo de request:

```json
{
  "user_public_key": "9h...abc",
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount_ui": 0.1,
  "slippage_bps": 50
}
```

Exemplo de resposta:

```json
{
  "cluster": "devnet",
  "quote": {
    "outAmount": "...",
    "otherAmountThreshold": "..."
  },
  "swap_transaction_base64": "...",
  "last_valid_block_height": 12345678,
  "disclaimer": "Review simulation and confirm in wallet before sending."
}
```

## 5. Campanhas e Usuários

Observação: no estado atual, rotas de campanha não têm prefixo `/v1`.

### `GET /auth/status/{token}`

Valida token/sessão.

### `GET /user/{user_id}`

Consulta dados resumidos do usuário.

### `GET /campaigns`

Lista campanhas disponíveis.

Retorna campanhas ativas persistidas em SQLite, com seed inicial quando o banco está vazio.

### `GET /campaigns/user`

Lista campanhas relacionadas ao usuário autenticado.

Header esperado:

- `Authorization: Bearer <token>`

### `POST /campaigns/create`

Cria campanha.

Payload principal: `title`, `description`, `campaign_type`, `reward_token`, `reward_per_participant`, `max_participants`, `profile_to_follow`, `tweet_id_to_engage`.

### `POST /campaigns/join`

Entrada mínima:

```json
{
  "campaign_identifier": "1"
}
```

### `POST /campaigns/verify`

Verifica tarefas associadas à campanha.

### `POST /campaigns/claim`

Solicita claim de recompensa.

## 6. Notificações

### `GET /v1/notifications/{twitter_user_id}`

Lista notificações de um usuário.

Retorna `success` e `notifications` ordenadas da mais recente para a mais antiga.

### `POST /v1/notifications/{notification_id}/ack`

Marca notificação como entregue/reconhecida.

Resposta:

```json
{ "success": true, "notification_id": 1, "status": "delivered" }
```

## 7. Status Codes e Erros

Formato de erro padrão FastAPI:

```json
{
  "detail": "mensagem"
}
```

Códigos comuns:

- `200` sucesso
- `400` payload inválido
- `401` não autorizado
- `404` recurso não encontrado
- `429` rate limit
- `500` erro interno
- `503` RPC da Solana indisponível
