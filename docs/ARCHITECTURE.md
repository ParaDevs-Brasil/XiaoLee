# Arquitetura XiaoLee — Estado Atual

> Atualizado em: **2026-05-09** | Sprint 9 — i18n EN/PT concluída.
> Estimativa geral de construção: **98%** (faixa estimada: **97% a 99%**).
> O que falta é exclusivamente **infraestrutura de produção e auditoria externa** — não código.

---

## 1. Visão Geral

XiaoLee é um protocolo DeFi conversacional que combina:

- **Backend FastAPI** — orquestração de mensagens, rate limiting (Redis), campanhas e integrações.
- **Gemini AI** — classificação de intenção e resposta contextual.
- **Solana Devnet + Jupiter** — fluxo de swap wallet-first (não-custodial).
- **Anchor (XiaoLee Core)** — registro on-chain de swaps, PDAs de usuário, emergency pause.
- **Frontend Next.js** — conexão Phantom, prepare/simulate/sign/send, campanhas, dashboard.

**Princípio central:** wallet-first e não-custodial. O backend prepara e orquestra; a assinatura sempre fica com o usuário.

---

## 2. Progresso por Camada

| Camada | Status | Entregas |
|---|---|---|
| Backend Core (FastAPI) | [##########] 100% | `/health`, `/health/detailed`, `/status`, `/chat`, `/metrics`, `/v1/messages/inbound` |
| Integrações de Canal | [##########] 100% | Webhooks Telegram/X (HMAC), Helius (best-effort record_swap) |
| IA (Gemini) | [##########] 100% | Intent detection + resposta contextual |
| Swap Prepare (Jupiter) | [##########] 100% | Quote + tx unsigned para assinatura em wallet |
| Wallet Execution (Frontend) | [##########] 100% | Connect, prepare, simulate, confirmação explícita, sign/send |
| UI/UX e Responsividade | [##########] 100% | Otimização mobile (`100dvh`, teclado virtual, drag/drop PFP); redesign premium Dashboard e Notifications (SVG icons, paleta unificada, zero emojis de layout); correções de contraste de texto |
| Campanhas | [##########] 100% | Join (409 idempotente), verify, claim com proof assinado, receipt persistido |
| Redis Rate Limiting | [##########] 100% | Sliding window + fallback in-memory automático |
| PostgreSQL + Alembic | [########..] 80% | Migração gerada; requer provisionamento em produção |
| Docker Compose | [##########] 100% | PostgreSQL + Redis + Grafana + migrate one-shot |
| Observabilidade | [##########] 100% | `/metrics` Prometheus, Grafana 8 painéis, `/health/detailed` |
| Anchor on-chain | [######....] 60% | AnchorClient com PDA real (solders), record_swap (dry_run até keypair em produção) |
| Emergency Pause | [##########] 100% | `pause_protocol` / `unpause_protocol` / `transfer_admin` no contrato |
| Testes de carga | [######....] 60% | Locust 3 cenários; executar em staging |
| QA suite | [##########] 100% | **65 testes passando**, 6 skips legados |
| Auditoria externa | [..........] 0% -- BLOQUEADOR | Não iniciada — bloqueia mainnet |

### Evolução por Sprint

| Sprint | Status | Entregas Principais |
|---|---|---|
| Fase 1 | Concluida | Base FastAPI, Gemini, rotas de inbound |
| Fase 2 | Concluida | Fluxo wallet-first (prepare/simulate/sign/send) |
| Fase 3 | Concluida | Hardening de webhooks (Telegram/X/Helius) |
| Fase 4 | Concluida | QA expandido, observabilidade HTTP, CI fullstack |
| Fase 5 | Concluida | Idempotência 409, Anchor Client, CORS hardening, 65 testes |
| Fase 6 | Concluida | PostgreSQL/Alembic, Redis Rate Limit, solders PDA, Locust |
| Fase 7 | Concluida | Docker Compose completo, Grafana, Emergency Pause Rust, Makefile, UI Mobile hardening |
| Fase 8 | Concluida | UI Premium Refactor: Dashboard e Notifications redesenhados (SVG icons inline, paleta unificada, responsividade mobile, Navbar com ícones premium) |
| Fase 9 | Concluida | i18n EN/PT: `LanguageContext`, `useLanguage()`, `t()` com dot-path + interpolação `{{var}}`, toggle EN/PT na Navbar, locale files `en.json`/`pt.json`, todos os componentes traduzidos, correções de contraste e tamanho de texto |
| Fase 10 | Planejada | Provisionar infra produção, Auditoria, HTTPS, Multisig, Mainnet beta |

---

## 3. Arquitetura de Alto Nível

```mermaid
graph TB
subgraph "Clientes"
FE[Next.js Frontend]
TG[Telegram Bot]
XX[X/Twitter DM]
end

subgraph "Backend FastAPI"
API[app.py + Rate Limiter Redis]
ORCH[OrchestrationService]
GEM[GeminiClient]
SOL[SolanaClient + Jupiter]
CAMP[Campaigns Router]
NOTIF[Notifications Router]
HEL[Helius Webhook]
ANCHOR[AnchorClient + solders]
DB[(PostgreSQL via asyncpg)]
REDIS[(Redis — Rate Limit)]
end

subgraph "Observabilidade"
PROM[Prometheus /metrics]
GRAF[Grafana Dashboard]
end

subgraph "Solana"
JUP[Jupiter v6 API]
RPC[Solana RPC / Helius]
PROG[XiaoLee Core Program]
end

FE --> API
TG --> API
XX --> API

API --> REDIS
API --> ORCH
ORCH --> GEM
ORCH --> SOL
API --> CAMP
API --> NOTIF
API --> HEL

HEL --> ANCHOR
ANCHOR --> PROG

ORCH --> DB
CAMP --> DB
NOTIF --> DB
HEL --> DB

SOL --> JUP
SOL --> RPC

API --> PROM
PROM --> GRAF
```

---

## 4. Fluxos Críticos

### 4.1 Inbound IA

1. Mensagem entra por `/v1/messages/inbound` (ou webhook Telegram/X).
2. Rate limiter (Redis sliding window) verifica limite por chave.
3. Backend valida segredo/HMAC e orquestra intent via Gemini.
4. Resposta persistida e entregue no canal de origem.

### 4.2 Swap Wallet-first

1. Frontend chama `/v1/solana/swap/prepare` — quote + tx unsigned.
2. Frontend simula na Devnet e exige confirmação explícita do usuário.
3. Wallet Phantom assina e envia para o RPC Solana.
4. Helius webhook notifica o backend após confirmação.
5. Backend chama `record_swap` via `AnchorClient` (best-effort, dry_run até keypair configurada).

### 4.3 Campanhas

1. Usuário chama `POST /campaigns/join` — `UniqueConstraint` garante idempotência (409 Conflict se já inscrito).
2. `POST /campaigns/verify` — verifica tarefas e emite `campaign:tasks_verified`.
3. `POST /campaigns/claim` — valida proof assinado pela wallet, persiste receipt, cria notificação in-app.

### 4.4 Observabilidade

1. Cada request HTTP é registrado em `xiaolee_http_requests_total` e `xiaolee_http_request_duration_seconds_avg`.
2. `GET /metrics` expõe métricas em formato Prometheus.
3. Grafana consome via datasource provisionado automaticamente.
4. `GET /health/detailed` verifica DB, Solana RPC, Gemini e Jupiter com latência por dependência.

---

## 5. Segurança Implementada

| Mecanismo | Status |
|---|---|
| HMAC para webhook X | OK |
| Secret token webhook Telegram | OK |
| Secret HMAC webhook Helius | OK |
| Rate limit por usuário/plataforma (Redis) | OK |
| CORS headers restritos (`CORS_ALLOWED_HEADERS` env) | OK |
| Fluxo não-custodial (sem chave privada do usuário no backend) | OK |
| Simulação + confirmação manual antes do envio | OK |
| 409 Conflict idempotente (UniqueConstraint DB) | OK |
| Emergency pause on-chain (`pause_protocol`) | OK |
| Admin keypair via env / vault (não hardcoded) | OK |
| PostgreSQL connection pool com `pool_pre_ping` | OK |
| Container não-root (Dockerfile) | OK |
| Auditoria externa | Pendente Pendente |
| HTTPS + HSTS em produção | Pendente Pendente |
| Multisig Gnosis Safe como admin | Pendente Pendente |
| Secrets via vault (não .env simples) | Pendente Pendente |

---

## 6. Estrutura de Diretórios (relevante)

```text
XiaoLee/
├── backend/
│ ├── alembic/ # Migrações de schema (Alembic async)
│ ├── database/
│ │ ├── database.py # Suporte dual SQLite/PostgreSQL
│ │ └── models.py
│ ├── server/
│ │ ├── app.py # FastAPI + lifespan + CORS + rate limiter
│ │ ├── rate_limiter.py # Redis sliding window + fallback in-memory
│ │ ├── settings.py # Env vars (DATABASE_URL, REDIS_URL, ...)
│ │ ├── metrics.py # Contadores Prometheus
│ │ ├── campaigns_routes.py
│ │ ├── notifications_routes.py
│ │ ├── webhooks/
│ │ │ └── helius_routes.py # record_swap best-effort
│ │ └── integrations/
│ │ └── anchor_client.py # PDA derivation + solders + submit
│ └── tests/ # 65 testes passando
├── frontend/
│ ├── src/
│ │ ├── components/ # Wallet, CampaignCard, Dashboard
│ │ ├── hooks/ # useJoinCampaign (409 tratado)
│ │ └── idl/ # xiaolee_core.json (IDL real)
├── solana-program/
│ └── xiaolee_core/
│ └── src/lib.rs # Program + emergency pause + events
├── load_tests/
│ └── locustfile.py # 3 cenários (Critical, ReadOnly, Chat)
├── ops/
│ ├── prometheus.yml
│ └── grafana/ # Dashboard provisionado automaticamente
├── docs/
│ ├── API_REFERENCE.md
│ ├── ARCHITECTURE.md # Este arquivo
│ ├── DESIGN_SYSTEM.md # Paleta, ícones, padrão de cards e layout
│ ├── SMART_CONTRACT.md
│ └── MAINNET_READINESS.md # 6 gates com checklist
├── docker-compose.yml # PostgreSQL + Redis + Grafana + migrate
├── .env.example # Template completo de variáveis
└── Makefile # db-migrate, load-test, anchor-build, ...
```

---

## 7. Próximos Passos (Fase 10 — Mainnet)

1. **Provisionar PostgreSQL 16+** e rodar `make db-migrate`.
2. **Provisionar Redis** e configurar `REDIS_URL` em produção.
3. **Configurar `SOLANA_ADMIN_KEYPAIR_B58`** no vault → testar `record_swap` submit real em devnet.
4. **HTTPS + HSTS** no servidor de produção.
5. **Contratar auditores** — mínimo 2 firmas independentes (ver `docs/MAINNET_READINESS.md`).
6. **Multisig Gnosis Safe** como admin do protocolo (substituir EOA).
7. **`make load-test-staging`** — validar p95 < 500ms.
8. **Mainnet beta** com TVL limitado + bug bounty ativo.

---

## 8. Nota sobre Testes Legados

Scripts de integração com Twikit e ferramentas de suporte antigas foram mantidos como referência operacional. Estão skipados no pytest (`-p no:anchorpy`, skip decorators) para não quebrar a suíte principal. A suíte ativa é de **65 testes passando**.
