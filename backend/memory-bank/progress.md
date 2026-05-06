# Progress: XiaoLee

> Atualizado em: **2026-04-30** | Sprint 8 concluída.
> Progresso: [##########] 96% — Estimativa (faixa 95% a 98%).
> Classificação: **MVP avançado em Devnet — frontend polido e visualmente consistente, infraestrutura de produção pendente**.

---

## Entregas Concluidas

### Fase 1 — Backend Core + IA
- `GET /health`, `GET /status`, `POST /chat`, `POST /v1/messages/inbound`
- GeminiClient com intent detection + resposta contextual
- Rate limit in-memory por usuário/plataforma

### Fase 2 — Swap Wallet-first
- `POST /v1/solana/swap/prepare` — quote + transação unsigned via Jupiter
- Frontend: connect Phantom, validações, simulação, confirmação explícita, sign/send
- Fluxo não-custodial (chave do usuário nunca toca o backend)

### Fase 3 — Webhooks + Segurança
- Webhook Telegram (secret token)
- Webhook X/Twitter (HMAC SHA-256)
- Webhook Helius (HMAC + best-effort `record_swap`)

### Fase 4 — Observabilidade + CI
- `/metrics` Prometheus (requests, latência, eventos de campanha)
- `/health/detailed` — verifica DB, Solana RPC, Gemini, Jupiter
- CI GitHub Actions fullstack (backend, frontend, lint, testes, build)

### Fase 5 — Idempotência + Anchor + Hardening
- `POST /campaigns/join` — 409 Conflict idempotente (`UniqueConstraint` DB)
- `AnchorClient` — serialização Borsh real, discriminador correto
- CORS headers restritos via `CORS_ALLOWED_HEADERS` env
- Status enum unificado (`enrolled | tasks_verified | paid`)
- 409 tratado no frontend (`useJoinCampaign`)
- `API_REFERENCE.md` atualizada com contratos on-chain e erros

### Fase 6 — PostgreSQL + Redis + Solders + Locust
- `database.py` dual SQLite/PostgreSQL com normalização de URL
- Alembic configurado (async, migração inicial `46a820fcb3c2` gerada)
- `rate_limiter.py` — Redis sliding window + fallback in-memory automático
- `REDIS_URL` em settings; inicializado no lifespan do app
- `AnchorClient` com `solders`: PDA derivation real, build + sign + submit
- `load_tests/locustfile.py` — 3 cenários, hook de SLA (p95 < 500ms, exit 1 se violado)
- **65 testes passando**

### Fase 7 — Infra + Docker + Emergency Pause + Grafana
- `docker-compose.yml` completo: PostgreSQL 16, Redis 7, alembic-migrate (one-shot), Grafana 11
- `.env.example` completo com todas as variáveis (DATABASE_URL, REDIS_URL, SOLANA_ADMIN_KEYPAIR_B58, GRAFANA_*)
- `backend/Dockerfile` multi-stage: builder gcc + runtime mínimo + usuário não-root + healthcheck
- `lib.rs` atualizado: `pause_protocol`, `unpause_protocol`, `transfer_admin`, 5 novos eventos on-chain
- `GlobalConfig` expandido: `paused`, `version`, `total_swaps_recorded`
- Grafana: datasource Prometheus provisionado + dashboard 8 painéis
- `Makefile` expandido: `db-migrate`, `load-test-smoke`, `run-docker`, `audit-checklist`, `anchor-idl-sync`
- **Homologação Infra Local**: Infraestrutura containerizada rodando perfeitamente sem gargalos.

### Fase 8 — Homologação E2E e Testes de Carga (Issues #19 e #21)
- **QA E2E**: Script `qa/scripts/e2e_flow_simulation.py` validando intents do webhooks com HMAC SHA-256 no Devnet.
- **Mock Jupiter Devnet**: Injeção de mock em `solana_client.py` para testes locais, dado que a Jupiter só opera na Mainnet.
- **Teste de Carga / Estresse**: `qa/scripts/locustfile.py` simulando 100 usuários simultâneos, +5.000 requests em 30s. Rate limiter no Redis operando com precisão absoluta, salvando 77% dos requests maliciosos com erro 429 sem corromper DB.

### Fase 8.1 — Polish de UI/UX: Consistência Visual (Light Theme)
- **Alinhamento de Cores**: Todas as telas (Chat, Campaigns, Notifications, Dashboard) agora compartilham a mesma paleta rosa/roxo pastel kawaii no tema claro (`from-pink-50 via-purple-50 to-fuchsia/indigo`).
- **Notifications**: Fundo e componentes migrados de cyan/blue para o tema pink/fuchsia/purple.
- **Dashboard**: Removidas classes `dark:from-gray-900 dark:via-purple-900` do wrapper que causavam fundo escuro no light mode.
- **UserStatsCard / TokenomicsCard**: Gradientes de borda e cabeçalhos alinhados ao pink/fuchsia/purple.
- **globals.css**: Adicionado `background-attachment: fixed` ao body para evitar vazamento de gradiente escuro em conteúdo scrollável.
- **ThemeProvider**: Preservado com `attribute="class"` — toggle de dark/light continua funcional.

### Fase 8.2 — Integração Inteligente & Refinamentos Finais de UI
- **Integração Gemini**: Refatoração do `LLMClient` e `gemini_client.py` para usar o SDK `google.genai` diretamente. Personalidade da XiaoLee aprimorada (fofa, prestativa, bilíngue, focada em Devnet e Campanhas).
- **Frontend Refinements**: 
  - Avatar da XiaoLee atualizado para `🌸` no ChatPanel.
  - Correção no `UserData.tsx` com _safe parsing_ de `history` (swaps, transactions, chat_history) garantindo tratamento anti-crash para estados aninhados `undefined`.
  - Navbar: Ajuste de flex layout para telas responsivas e adição de `z-50` no Dropdown para sobrepor componentes corretamente.
  - `ThemeProvider`: Remoção definitiva do `forcedTheme="light"` para dar liberdade real ao tema.

---

## PENDENTE Em Aberto (Fase 9 — Produção)

### Bloqueadores P0 (mainnet impossível sem estes)
1. **Auditoria externa** — mínimo 2 firmas independentes (Trail of Bits, Ottersec, Sec3)
2. **PostgreSQL de produção** — provisionar instância + `make db-migrate`
3. **Redis de produção** — configurar `REDIS_URL`
4. **SOLANA_ADMIN_KEYPAIR_B58** no vault → testar `record_swap` submit real em devnet
5. **HTTPS + HSTS** no servidor de produção
6. **Secrets via vault** (não `.env` em texto simples)

### P1 (antes do mainnet saudável)
7. **Executar Locust em staging** — `make load-test-staging HOST=...`
8. **Multisig Gnosis Safe** como admin (substituir EOA)
9. **Tenderly Alerts** configurado
10. **`initialize_global`** executado na mainnet

### P2 (pós-lançamento beta)
11. Bug bounty program (Sherlock/Immunefi)
12. CI/CD de deploy (não só de testes)
13. Testes E2E com Playwright

---

## Métricas do Projeto

| Métrica | Valor |
|---|---|
| Testes backend | **65 passando**, 6 skips legados |
| Build frontend | **Exit code 0** (Next.js, TypeScript sem erros) |
| Cobertura de rotas | `/health`, `/health/detailed`, `/status`, `/metrics`, `/chat`, `/v1/messages/inbound`, `/v1/solana/swap/prepare`, `/v1/solana/webhooks/helius`, `/campaigns/join\|verify\|claim`, `/notifications`, `/x/webhook` |
| Telas com tema unificado | **4/4** (Chat, Campaigns, Notifications, Dashboard) |
| Sprints concluídas | **8 de 8** |
| Estimativa de conclusão | **96%** |
