# XiaoLee Protocol

> Assistente de IA multi-plataforma para Solana com backend FastAPI, integrações Telegram/X, Gemini para orquestração de intenção, fluxo wallet-first e campanhas DeFi on-chain.
> **Atualizado: 2026-04-24 | Sprint 7 concluída | 93% completo**

## Interface Atual

| Chat | Dashboard | Campanhas | Notificações |
|---|---|---|---|
| ![Tela do chat XiaoLee](XiaoleeChat.png) | ![Dashboard XiaoLee](Dashboard.png) | ![Tela de campanhas XiaoLee](Campaigns.png) | ![Notificações XiaoLee](Notifications.png) |

---

## Status do Projeto

Progresso: [#########.] 93% — Código completo. O que falta é exclusivamente **infraestrutura de produção e auditoria externa**.

| Bloco | Status | Detalhe |
|---|---|---|
| Core API FastAPI | [##########] 100% | `/health`, `/health/detailed`, `/status`, `/metrics`, `/chat`, `/v1/messages/inbound` |
| Integração Gemini | [##########] 100% | Intent detection + resposta contextual |
| Webhooks Telegram/X | [##########] 100% | HMAC + secret token validados |
| Solana/Jupiter (prepare) | [##########] 100% | Quote + tx unsigned para wallet assinar |
| Wallet-first frontend | [##########] 100% | Connect, prepare, simulate, sign/send |
| Campanhas Devnet | [##########] 100% | Join (409 idempotente), verify, claim com proof assinado |
| Redis Rate Limiting | [##########] 100% | Sliding window + fallback in-memory automático |
| PostgreSQL + Alembic | [########..] 80% | Migração gerada; provisionar DB em produção |
| Docker Compose completo | [##########] 100% | PostgreSQL + Redis + Grafana + migrate one-shot |
| Grafana Dashboard | [##########] 100% | 8 painéis, provisionamento automático |
| Anchor on-chain | [######....] 60% | PDA real (solders), record_swap (dry_run até keypair em produção) |
| Emergency Pause | [##########] 100% | `pause_protocol` / `unpause_protocol` no contrato Rust |
| QA backend | [##########] 100% | **65 testes passando**, 6 skips legados |
| Auditoria externa | [..........] 0% -- BLOQUEADOR | Não iniciada — P0 para mainnet |

---

## Arquitetura do Sistema

### Visao Geral dos Componentes

```mermaid
graph TB
    subgraph CANAIS["Canais de Entrada"]
        FE["Next.js Frontend<br>(Phantom Wallet)"]
        TG["Telegram Bot"]
        XX["X / Twitter DM"]
    end

    subgraph INFRA_ENTRADA["Camada de Entrada"]
        RL["Rate Limiter<br>(Redis Sliding Window)<br>+ fallback in-memory"]
        CORS["CORS Guard<br>(headers restritos por env)"]
    end

    subgraph BACKEND["Backend FastAPI"]
        APP["app.py<br>(lifespan + middleware)"]
        ORCH["OrchestrationService<br>(intent + resposta)"]
        GEM["GeminiClient<br>(intent detection)"]
        SOL["SolanaClient<br>(Jupiter swap prepare)"]
        CAMP["Campaigns Router<br>(join / verify / claim)"]
        NOTIF["Notifications Router<br>(in-app inbox)"]
        HEL["Helius Webhook<br>(confirma swap on-chain)"]
        ANCHOR["AnchorClient<br>(solders: PDA + Borsh + sign)"]
        MET["Metrics<br>(/metrics Prometheus)"]
        HLT["Health<br>(/health/detailed)"]
    end

    subgraph BANCO["Persistencia"]
        DB[("PostgreSQL 16<br>(asyncpg + Alembic)")]
        SQLITE[("SQLite<br>(desenvolvimento local)")]
        REDIS[("Redis 7<br>(rate limiting)")]
    end

    subgraph OBS["Observabilidade"]
        PROM["Prometheus<br>:9090"]
        GRAF["Grafana<br>:3001<br>(8 paineis)"]
    end

    subgraph SOLANA["Solana / On-chain"]
        JUP["Jupiter v6<br>(quote + swap tx)"]
        RPC["Solana RPC<br>(Helius)"]
        PROG["XiaoLee Core Program<br>(Anchor / Rust)<br>PDA: global_config + user_state<br>Emergency pause on-chain"]
    end

    TG -->|HMAC secret| APP
    XX -->|HMAC SHA-256| APP
    FE -->|REST JSON| APP

    APP --> RL
    APP --> CORS
    APP --> ORCH
    APP --> CAMP
    APP --> NOTIF
    APP --> HEL
    APP --> MET
    APP --> HLT

    RL <--> REDIS

    ORCH --> GEM
    ORCH --> SOL
    ORCH --> DB

    CAMP --> DB
    NOTIF --> DB
    HEL --> DB
    HEL --> ANCHOR

    SOL --> JUP
    FE -->|sign + send| RPC
    ANCHOR -->|record_swap<br>(admin keypair)| PROG
    RPC -->|webhook evento| HEL

    APP -.->|prod| DB
    APP -.->|dev| SQLITE

    MET --> PROM
    PROM --> GRAF
```

### Fluxo de Swap Wallet-first

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend Next.js
    participant API as Backend FastAPI
    participant JUP as Jupiter v6
    participant RPC as Solana RPC
    participant HEL as Helius Webhook
    participant ANCH as AnchorClient
    participant PROG as XiaoLee Program

    U->>FE: 1. Conecta carteira Phantom
    U->>FE: 2. Informa token + valor

    FE->>API: POST /v1/solana/swap/prepare
    API->>JUP: GET /quote (token_in, token_out, amount)
    JUP-->>API: Quote + route
    API->>JUP: POST /swap (unsigned tx)
    JUP-->>API: Transacao serializada (unsigned)
    API-->>FE: { quote, tx_unsigned, simulation_result }

    FE->>RPC: simulateTransaction()
    RPC-->>FE: Resultado da simulacao

    FE->>U: Exibe quote + taxa de gas
    U->>FE: 3. Confirma explicitamente

    FE->>RPC: sendTransaction() com assinatura Phantom
    RPC-->>FE: { signature }
    FE->>U: Swap confirmado

    Note over RPC,HEL: Helius monitora a transacao on-chain
    RPC-->>HEL: Evento de confirmacao (webhook)
    HEL->>API: POST /v1/solana/webhooks/helius
    API->>ANCH: record_swap(twitter_id, volume)
    ANCH->>PROG: Instrucao Anchor (PDA + Borsh + admin sign)
    PROG-->>ANCH: Swap gravado on-chain
    API->>API: Persiste notificacao in-app
```

### Fluxo de Campanha

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant API as Backend
    participant DB as PostgreSQL
    participant W as Phantom Wallet
    participant PROG as XiaoLee Program

    U->>FE: Visualiza campanha ativa
    FE->>API: POST /campaigns/join
    API->>DB: INSERT participant (UniqueConstraint)
    alt ja inscrito
        DB-->>API: Constraint violation
        API-->>FE: 409 Conflict { already_joined: true }
    else nova inscricao
        DB-->>API: OK
        API-->>FE: 201 Created
    end

    U->>FE: Realiza tarefas (swap, follow, retweet)
    FE->>API: POST /campaigns/verify
    API->>DB: UPDATE status = tasks_verified
    API-->>FE: { status: "tasks_verified" }

    U->>W: Assina proof da campanha
    W-->>FE: { proof_signature }
    FE->>API: POST /campaigns/claim { proof_signature }
    API->>API: Valida assinatura ED25519
    API->>DB: INSERT claim_receipt
    API->>PROG: (futuro) distribuicao de recompensa
    API-->>FE: 200 OK { receipt_id, status: "paid" }
    FE->>U: Notificacao in-app: recompensa recebida
```

---

## Quickstart

```bash
# 1. Setup completo (venv + npm + .env)
make init

# 2. Subir em modo dev
make dev

# 3. Verificar ambiente
make smoke
```

**OU com Docker (stack completa):**

```bash
cp .env.example .env # preencha as variáveis
make run-docker
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Docs Swagger | http://localhost:8000/docs |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

---

## Variáveis de Ambiente

```bash
cp .env.example .env
```

Obrigatórias para rodar localmente:

| Variável | Descrição |
|---|---|
| `GEMINI_API_KEY` | Chave Google Gemini (classifica intenção) |
| `TELEGRAM_WEBHOOK_SECRET` | Secret para webhook Telegram |
| `X_WEBHOOK_SECRET` | HMAC para webhook X/Twitter |
| `HELIUS_WEBHOOK_SECRET` | HMAC para webhook Helius |

Opcionais (habilitam funcionalidades adicionais):

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | PostgreSQL em produção (vazio = SQLite) |
| `REDIS_URL` | Redis para rate limiting (vazio = in-memory) |
| `SOLANA_ADMIN_KEYPAIR_B58` | Admin keypair para `record_swap` on-chain (vazio = dry_run) |

---

## Testes

```bash
# Suite backend completa (65 testes)
make test-backend

# Build frontend limpo
cd frontend && npm run build

# Testes de carga (20 users, 2 min)
make load-test-smoke

# Checklist de mainnet
make audit-checklist
```

---

## Banco de Dados

```bash
# Aplicar migrações (SQLite local ou PostgreSQL via DATABASE_URL)
make db-migrate

# Status das migrações
make db-status

# Nova migração após alterar models.py
make db-new-migration MSG="descricao"
```

---

## Smart Contract

| Item | Valor |
|---|---|
| Program ID | `Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM` |
| Cluster | Devnet |
| Instruções | `initialize_global`, `initialize_user`, `record_swap`, `pause_protocol`, `unpause_protocol`, `transfer_admin` |

```bash
# Compilar
make anchor-build

# Deploy devnet
make anchor-deploy-devnet

# Sincronizar IDL com frontend
make anchor-idl-sync
```

---

## Endpoints Principais

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/health` | Health check básico |
| `GET` | `/health/detailed` | Health com latência por dependência |
| `GET` | `/status` | Status resumido |
| `GET` | `/metrics` | Métricas Prometheus |
| `POST` | `/chat` | Chat com agente XiaoLee |
| `POST` | `/v1/messages/inbound` | Mensagem inbound (rate limited) |
| `POST` | `/v1/integrations/telegram/webhook` | Webhook Telegram |
| `POST` | `/v1/integrations/x/webhook` | Webhook X/Twitter (HMAC) |
| `POST` | `/v1/solana/swap/prepare` | Prepara swap (quote + tx unsigned) |
| `POST` | `/v1/solana/webhooks/helius` | Webhook Helius (confirma swap) |
| `GET` | `/campaigns` | Lista campanhas |
| `POST` | `/campaigns/join` | Entra em campanha (409 se já inscrito) |
| `POST` | `/campaigns/verify` | Verifica tarefas |
| `POST` | `/campaigns/claim` | Claim com proof assinado |
| `GET` | `/v1/notifications/me` | Notificações in-app |

> Documentação completa: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)

---

## Segurança Implementada

- HMAC SHA-256 para webhooks X e Helius
- Secret token para webhook Telegram
- Rate limiting Redis (sliding window) com fallback in-memory
- CORS headers restritos via `CORS_ALLOWED_HEADERS` env
- Fluxo não-custodial (chave do usuário nunca toca o backend)
- 409 Conflict idempotente (UniqueConstraint no banco)
- Emergency pause on-chain (`pause_protocol`)
- Container não-root no Dockerfile
- Suporte a secrets via vault (produção)

---

## Linha do Tempo

| Fase | Status | Entregas |
|---|---|---|
| Fase 1 | CONCLUIDA | FastAPI, Gemini, inbound |
| Fase 2 | CONCLUIDA | Wallet-first (prepare/simulate/sign/send) |
| Fase 3 | CONCLUIDA | Webhooks hardening (Telegram/X/Helius) |
| Fase 4 | CONCLUIDA | QA, observabilidade, CI fullstack |
| Fase 5 | CONCLUIDA | Idempotência, Anchor client, CORS, 65 testes |
| Fase 6 | CONCLUIDA | PostgreSQL, Redis, solders, Locust |
| Fase 7 | CONCLUIDA | Docker completo, Grafana, Emergency pause |
| Fase 8 | PLANEJADA | Infra produção, auditoria, HTTPS, Multisig, Mainnet |

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitetura completa, diagramas, fluxos |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Rotas, payloads, códigos de erro |
| [`docs/SMART_CONTRACT.md`](docs/SMART_CONTRACT.md) | Instruções on-chain, PDAs, eventos |
| [`docs/MAINNET_READINESS.md`](docs/MAINNET_READINESS.md) | 6 gates + checklist para mainnet |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, padrões, como contribuir |
| [`load_tests/README.md`](load_tests/README.md) | Instruções de teste de carga (Locust) |
| [`backend/memory-bank/progress.md`](backend/memory-bank/progress.md) | Trilha de construção detalhada |
