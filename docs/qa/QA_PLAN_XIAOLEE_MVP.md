# QA Plan XiaoLee MVP

## Escopo validado

- Normalizacao de payloads Telegram e X
- Roteamento de intencao
- Execucao de saldo/cotacao no orquestrador
- Resposta fallback de ajuda

## Testes implementados

- backend/tests/test_xiaolee_mvp_orchestration.py
  - test_detect_balance_intent_with_wallet
  - test_detect_swap_quote_intent
  - test_help_fallback_uses_gemini_reply
  - test_telegram_adapter_normalization
  - test_x_adapter_normalization

## Estrategia de regressao

1. Rodar testes unitarios a cada PR
2. Executar smoke local da API:
   - GET /health
   - POST /v1/messages/inbound
3. Adicionar testes de contrato para webhooks reais

## Criterios de aceite do MVP

- API sobe com Docker
- Endpoint /health retorna status ok e checagem RPC
- Mensagem de saldo com carteira retorna valor em SOL
- Mensagem de swap retorna cotacao Jupiter
- Frontend prepara swap, simula em devnet e exige confirmacao explicita antes de assinar/enviar
