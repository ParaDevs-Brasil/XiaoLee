# XiaoLee — Mainnet Readiness Checklist

> Documento de referência para o rollout controlado do protocolo XiaoLee na mainnet Solana.
> Atualizado em: **2026-04-24** | Sprint 7 concluída.

---

## Status Geral

| Categoria | Status | Progresso |
|---|---|---|
| Contratos on-chain | [######....] 60% | Emergency pause Concluido, record_swap dry_run; submit real pendente keypair |
| Backend API | [##########] 100% | **65 testes** passando, CORS hardened, Redis limiter |
| Frontend | [##########] 100% | TypeScript sem erros, enum unificado |
| PostgreSQL + Alembic | [########..] 80% | Migração gerada; **provisionar DB de produção** |
| Redis Rate Limiting | [########..] 80% | Código pronto + fallback; **configurar REDIS_URL em produção** |
| Docker Compose | [##########] 100% | PostgreSQL + Redis + Grafana + migrate one-shot |
| Grafana / Observabilidade | [##########] 100% | Dashboard provisionado automaticamente |
| Testes de carga | [######....] 60% | Locust 3 cenários; **executar em staging** |
| Auditoria externa | [..........] 0% -- BLOQUEADOR | Iniciar contratação — bloqueia mainnet |
| Secrets / Vault | [..........] 0% | SOLANA_ADMIN_KEYPAIR_B58 + DB pass + Redis pass |
| HTTPS + HSTS | [..........] 0% | Configurar no deploy de produção |
| Multisig Gnosis Safe | [..........] 0% | Substituir admin EOA antes do mainnet |
| Bug bounty | [..........] 0% | Após auditoria |

---

## Gate 1 — Contratos On-chain

### Programa XiaoLee Core

| Item | Status | Evidência |
|---|---|---|
| Program ID confirmado | Concluido | `Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM` |
| IDL real no frontend | Concluido | `frontend/src/idl/xiaolee_core.json` |
| Cluster alinhado (devnet) | Concluido | `Anchor.toml`, `useXiaoLeeProgram.ts` |
| `initialize_global` | Concluido | Executado uma vez no deploy |
| `initialize_user` | Concluido | Chamado pelo frontend via Anchor SDK |
| `record_swap` — serialização | Concluido | Discriminador correto, Borsh u64 |
| `record_swap` — submit real | PENDENTE P0 | Pendente `SOLANA_ADMIN_KEYPAIR_B58` + Sprint 7 |
| Upgrade path definido | Concluido | UUPS documentado no ADR |
| Emergency pause | Em andamento | Verificar se implementado no Rust |

### Ações P0 antes do mainnet

- [ ] Configurar `SOLANA_ADMIN_KEYPAIR_B58` em produção via vault
- [ ] Executar `anchor deploy --provider.cluster mainnet-beta`
- [ ] Verificar Program ID em Solscan/Explorer
- [ ] Executar `initialize_global` na mainnet
- [ ] Testar `record_swap` com keypair real em devnet antes do mainnet

---

## Gate 2 — Backend API

| Item | Status | Evidência |
|---|---|---|
| Testes unitários | Concluido | 63 passed, 6 skipped |
| CORS headers restritos | Concluido | `CORS_ALLOWED_HEADERS` env, não wildcard |
| Rate limiting | Concluido | Redis (com fallback in-memory) |
| Idempotência (409) | Concluido | `uq_participant_campaign_user` constraint |
| Observabilidade `/metrics` | Concluido | Prometheus format |
| `/health/detailed` | Concluido | DB, Solana, Gemini, Jupiter |
| Helius webhook | Concluido | HMAC validado, best-effort record_swap |
| PostgreSQL pronto | Em andamento | `asyncpg` instalado, Alembic configurado |
| Redis em produção | Pendente | Configurar `REDIS_URL` em produção |
| Secrets via vault | Pendente | Implementar HashiCorp/AWS Secrets Manager |

---

## Gate 3 — Frontend

| Item | Status | Evidência |
|---|---|---|
| Build TypeScript limpo | Concluido | Exit code 0, sem type errors |
| IDL real (sem mock) | Concluido | `useXiaoLeeProgram.ts` |
| Status enum unificado | Concluido | `enrolled / tasks_verified / paid` |
| 409 Conflict tratado | Concluido | `useJoinCampaign.ts` — flag `alreadyJoined` |
| Wallet connect | Concluido | Devnet configurada |
| Error handling | Concluido | `extractErrorMessage` centralizado |

---

## Gate 4 — Banco de Dados

| Item | Status | Notas |
|---|---|---|
| SQLite (dev/devnet) | Concluido | Funcional com aiosqlite |
| PostgreSQL suporte | Concluido | `asyncpg` + `_build_database_url()` |
| Alembic configurado | Concluido | env.py async, migração inicial gerada |
| Migração inicial | Concluido | `46a820fcb3c2_initial_schema.py` |
| Connection pool | Concluido | pool_size=10, pool_pre_ping=True |
| DB de produção | Pendente | Provisionar PostgreSQL 15+ |

### Comando de migração em produção

```bash
export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/xiaolee_prod"
cd backend && alembic upgrade head
```

---

## Gate 5 — Performance (SLA)

Meta Mainnet:

| Métrica | Target | Status |
|---|---|---|
| p50 | < 200ms | Em andamento Pendente teste de carga staging |
| p95 | < 500ms | Em andamento Pendente teste de carga staging |
| p99 | < 1000ms | Em andamento Pendente |
| Error rate | < 1% | Em andamento Pendente |

### Executar testes de carga

```bash
# Smoke test local
locust -f load_tests/locustfile.py \
--host=http://localhost:8000 \
--users=20 --spawn-rate=4 --run-time=120s --headless

# Staging (pré-mainnet)
locust -f load_tests/locustfile.py \
--host=https://api-staging.xiaolee.io \
--users=100 --spawn-rate=10 --run-time=600s --headless \
--html=load_tests/reports/staging_$(date +%Y%m%d).html
```

---

## Gate 6 — Segurança

| Item | Status | Prazo |
|---|---|---|
| Auditoria externa (smart contracts) | [..........] 0% -- BLOQUEADOR | Iniciar imediatamente |
| Auditoria externa (backend API) | [..........] 0% -- BLOQUEADOR | Junto com SC |
| Bug bounty program | Pendente | Após auditoria |
| Secrets em vault | Pendente | Sprint 7 |
| Pen test frontend | Em andamento | Após auditoria SC |
| HTTPS + HSTS | Pendente | Configurar no deploy |

### Auditores Recomendados

| Empresa | Especialização | Contato |
|---|---|---|
| Trail of Bits | Solana + Rust | trailofbits.com |
| Ottersec | Solana-first | osec.io |
| Sec3 | Solana programs | sec3.dev |
| Sherlock | DeFi protocols | sherlock.xyz |

> [ATENCAO] Mínimo 2 auditorias independentes** são obrigatórias antes do mainnet com TVL real.

---

## Plano de Rollout (Sprint 7 → Mainnet)

```
Sprint 7
├── Configurar PostgreSQL de produção + migrar
├── Configurar Redis em produção
├── SOLANA_ADMIN_KEYPAIR_B58 no vault
├── record_swap submit real (solders completo)
├── Testes de carga em staging (p95 < 500ms)
└── Contratar auditores

Sprint 8
├── Auditoria Smart Contracts (2–4 semanas)
├── Correções pós-auditoria
├── Pen test frontend
└── Bug bounty em testnet pública

Sprint 9 — Mainnet Beta
├── Deploy em mainnet com TVL limitado
├── Monitor Tenderly + OpenZeppelin Defender
├── Rollout gradual: 10% → 50% → 100%
└── Bug bounty público ativo
```

---

## Resposta a Incidentes

| Severidade | Definição | Tempo | Ação |
|---|---|---|---|
| P0 | Fundos em risco / sistema down | < 15 min | Pausar contratos, war room |
| P1 | Funcionalidade crítica degradada | < 1 hora | Hotfix, comunicado |
| P2 | Funcionalidade não-crítica | < 24 horas | Fix planejado |

**Contatos de emergência:**
- Admin multisig: Gnosis Safe (configurar antes do mainnet)
- Monitor: Tenderly Alerts (configurar antes do mainnet)
- Canal de incidentes: Discord #incident-response
