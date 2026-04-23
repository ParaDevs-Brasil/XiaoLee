# Tech Context: XiaoLee

Atualizacao documental: **2026-04-23**.

## Stack Principal

- Backend: Python 3.12, FastAPI, SQLAlchemy, Pydantic.
- IA: Gemini (com fallback heuristico quando aplicavel).
- Blockchain: Solana Devnet, Jupiter APIs, Helius webhook.
- Frontend: Next.js 15, React 19, TypeScript, Tailwind.
- Testes frontend: Vitest + Testing Library + jsdom.

## Estado de QA

- Backend principal: `../.venv/bin/pytest -q` -> 34 passed, 8 skipped.
- Frontend principal: `npm test` -> 13 passed.
- CI fullstack: workflow dedicado com backend pytest, frontend lint, frontend tests e frontend build.
- Skips são intencionais para scripts de integração Twikit e utilitários externos sem dependências instaladas.

## Estrutura Relevante

- `backend/server/app.py`: composicao principal de rotas.
- `backend/server/campaigns_routes.py`: campanhas/usuario/auth status.
- `backend/server/notifications_routes.py`: inbox e ack.
- `backend/server/metrics.py`: contadores HTTP e renderização Prometheus.
- `backend/server/webhooks/helius_routes.py`: eventos on-chain.
- `frontend/src/components/navbar/Wallet.tsx`: fluxo wallet-first.
- `frontend/src/utils/swap.ts`: conversoes e resumo de quote.

## Comandos Operacionais

Backend:

- `cd backend && uvicorn server.app:app --reload`
- `cd backend && pytest -q`
- `cd backend && ../.venv/bin/pytest -q`

Frontend:

- `cd frontend && npm run dev`
- `cd frontend && npm test`
- `cd frontend && npm run lint`

## Restricoes Tecnicas Atuais

- Pipeline CI fullstack consolidado para backend e frontend.
- Observabilidade HTTP básica com `/metrics` já exposta.
- Escopo de producao mainnet depende de hardening e auditoria.
- Fluxo critico e wallet-first; backend nao deve custodiar chave de usuario.
