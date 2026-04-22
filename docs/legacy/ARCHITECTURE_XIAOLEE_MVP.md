# Arquitetura XiaoLee MVP (Implementada)

## 1. Visao Geral

Este MVP implementa a arquitetura distribuida proposta para XiaoLee com foco em fluxo:

1. Mensagem inbound (Telegram ou X)
2. Orquestracao de intencao com Gemini + fallback heuristico
3. Acao Solana Devnet (saldo e cotacao de swap via Jupiter)
4. Resposta estruturada para o canal

## 2. Componentes

### Core API (FastAPI)

- Local: backend/server/app.py
- Endpoints:
  - GET /health
  - POST /v1/messages/inbound
  - POST /v1/integrations/telegram/webhook
  - POST /v1/integrations/x/webhook

### IA Nativa Gemini

- Local: backend/server/integrations/gemini_client.py
- Uso:
  - classificacao de intencao em JSON
  - geracao de resposta contextual em PT-BR

### Solana Devnet + Jupiter

- Local: backend/server/integrations/solana_client.py
- Funcoes:
  - getHealth (RPC)
  - getBalance (RPC)
  - quote de swap USDC->SOL (Jupiter API)
  - preparacao de transacao de swap para assinatura do usuario

### Assinatura Wallet-first (Frontend)

- Local: frontend/src/components/navbar/Wallet.tsx
- Fluxo:
  - conecta Phantom
  - chama /v1/solana/swap/prepare
  - simula transacao antes de assinar
  - exige confirmacao explicita do usuario
  - assina e envia na devnet

### Adaptadores de Canal

- Telegram: backend/server/integrations/telegram_adapter.py
- X/Twitter: backend/server/integrations/x_adapter.py

### Orquestrador

- Local: backend/server/orchestration/service.py
- Regras:
  - Intent detection: Gemini primeiro, fallback local
  - Acoes: check_balance, swap_quote, help

## 3. Fluxo E2E

1. Canal envia payload bruto
2. Adapter normaliza dados de usuario/mensagem
3. Orchestrator detecta intencao
4. Solana client executa consulta em devnet
5. API retorna resposta padronizada

## 4. Seguranca (baseline MVP)

- Sem custodia de chave privada no fluxo atual
- Operacoes on-chain limitadas a leitura/cotacao
- Producao deve incluir:
  - validacao de assinatura webhook X
  - token de verificacao Telegram
  - rate limiting por user_id/plataforma
  - secrets manager para GEMINI_API_KEY

## 5. Evolucao para producao

1. Adicionar assinatura e envio de transacoes (wallet standard)
2. Integrar Helius webhooks para monitoramento de confirmacao
3. Persistir historico de conversas e intents em banco
4. Adicionar RAG de protocolos Solana
