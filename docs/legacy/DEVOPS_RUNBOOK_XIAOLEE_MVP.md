# DevOps Runbook XiaoLee MVP

## 1. Preparacao

1. Copiar variaveis:
   - cp .env.example .env
2. Preencher GEMINI_API_KEY

## 2. Subir stack

- docker compose up --build

Servicos:
- xiaolee-core: API FastAPI na porta 8000
- prometheus: coleta basica na porta 9090

## 3. Validacao rapida

- curl http://localhost:8000/health
- curl -X POST http://localhost:8000/v1/messages/inbound \
  -H "Content-Type: application/json" \
  -d '{"platform":"telegram","user_id":"u1","text":"quote 5 usdc para sol"}'

- cd frontend && npm test

## 4. CI/CD

Workflow:
- .github/workflows/backend-ci.yml

Pipeline:
1. Setup Python 3.12
2. Install deps de teste
3. Executa testes MVP backend
4. Executa testes unitarios frontend

## 5. Observabilidade e operacao

- Logs por stdout (container)
- Health endpoint monitora disponibilidade de RPC Solana
- Proximo passo: expor /metrics Prometheus nativo
