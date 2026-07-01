# XiaoLee — Lepton Hackathon Sprint Plan
> Deadline real: **6 jul 2026, 23:59 ET** | Hoje: 29 jun | Dias restantes: **7**
> Scoring: Agentic 30% · Traction 30% · Circle Tools 20% · Innovation 20%
> Score atual estimado: **~57/100** → meta: **85+/100**

---

## Diagnóstico (29 jun — pós-sessão de infra)

| Critério | Peso | Estado real hoje | Score |
|----------|------|-----------------|-------|
| Agentic | 30% | Loop Claude completo, 4 tools, background task — mas requer trigger manual via API | ~22/30 |
| Traction | 30% | Infra SSE + métricas pronta; **zero transações reais** no testnet | ~4/30 |
| Circle Tools | 20% | W3S ArcClient, CCTP, circle_crypto — **arc_x402 escrito e REGISTRADO no app.py** (resolvido 28/jun) | ~16/20 |
| Innovation | 20% | PQC ML-DSA-87 implementado, CCTP E2E com 4 etapas — não aparece no demo ainda | ~12/20 |
| **TOTAL** | | | **~54/100** |

**O que nos separa do Grand Prize:** Traction real (USDC fluindo) + Circle credentials reais + deploy público + vídeo forte.

---

## P0 — Fix urgente (bloqueantes de nota)

### P0-01 — ~~Registrar `arc_x402_routes.py` no `app.py`~~ DONE (28/jun)
`arc_x402_router` adicionado em `app.py` linhas 45 e 133.
`POST /v1/arc/ai/query` sem X-Payment → retorna 402 com `"network":"arc","asset":"USDC"`.
Verificado: import OK, payment info builder OK, sandbox verify OK.

---

### P0-02 — Configurar Circle credentials reais (BLOQUEANTE DE TRACTION)
**Owner: f0ntz | ETA: hoje**

O `ARC_SANDBOX=true` faz todos os pagamentos serem simulados — **Traction = 0** para o júri.
A `CIRCLE_API_KEY` atual no `.env` é um placeholder e retorna 401 na API Circle.

**Passos:**
1. Acesse [console.circle.com](https://console.circle.com) → API Keys → Create Sandbox Key
2. Atualize no `.env`:
```bash
CIRCLE_API_KEY=<key_real_do_console>     # formato: TEST_API_KEY:uuid:hex
CIRCLE_ENTITY_SECRET=01e2accc96c870...   # já gerado (manter)
ANTHROPIC_API_KEY=<sua_key>              # para o ClaudeAgentEngine
```
3. Rode o setup da wallet:
```bash
cd XiaoLee/backend
../.venv/bin/python scripts/setup_circle_wallet.py
# Output: CIRCLE_WALLET_ID=<uuid> + endereço EVM
```
4. Copie `CIRCLE_WALLET_ID` e o endereço EVM para `.env`:
```bash
CIRCLE_WALLET_ID=<uuid_da_wallet>
ARC_X402_WALLET_ADDRESS=0x<endereco_evm>
ARC_SANDBOX=false
```
5. Funde a wallet com USDC de teste: [faucet.circle.com](https://faucet.circle.com)

---

### P0-03 — ~~Corrigir pytest-asyncio~~ DONE (29/jun)
`pytest-asyncio==1.3.0` já instalado no venv. 198 testes coletam OK.
Único erro de coleta pré-existente: `scripts/db/test_mcp_migration.py` (módulo `mcp` não instalado — não bloqueia os testes de Arc/x402).

---

## P1 — Traction real (30% da nota — o que decide o pódio)

### P1-01 — Primeira transação USDC real na Arc testnet
**Owner: f0ntz + Jeiel | ETA: D29-D30**

Sem isso o hackathon está perdido. Passo a passo:
1. P0-02 resolvido (Circle vars configuradas)
2. `POST /v1/agent/run-campaign` com `campaign_id` real + `budget_usdc: 20`
3. Confirmar tx hash real no Circle dashboard (não `sandbox_tx_xxxx`)
4. Chamar `POST /v1/payments/settled` para registrar no feed SSE
5. Verificar `GET /v1/traction/stats` mostra `usdc_total > 0`

---

### P1-02 — Onboarding de creators reais no testnet
**Owner: Mari | ETA: D29-D01**

O júri vai olhar o dashboard ao vivo. Precisa de criadores reais, não seeds.

- Objetivo: **5 creators registrados** via `POST /v1/creator/register` com wallet Sepolia real
- Mari usa `seed_demo_payments.py` como referência para o fluxo, mas com wallets reais
- Compartilhar link de onboarding no Discord do hackathon — pede para outros builders testarem

```bash
# Registrar creator (já tem endpoint)
curl -X POST http://<staging>/v1/creator/register \
  -H "Content-Type: application/json" \
  -d '{"handle": "@testcreator", "circle_wallet_id": "<uuid>"}'
```

---

### P1-03 — Dashboard ao vivo com USDC-flow visível
**Owner: Mari | ETA: D30-D01**

O júri abre o link e precisa ver USDC saindo em tempo real.

- Frontend já tem `AgentStatus.tsx` e `useAgentStatus.ts`
- Falta: página pública `/dashboard` que conecta ao SSE `/v1/traction/feed`
- Métricas mínimas visíveis: total USDC pago, número de creators, latência média, feed de pagamentos

Se o frontend demorar: criar uma página HTML estática simples com `EventSource` apontando para o SSE. O código da API já está pronto — é só o visual.

---

### P1-04 — Deploy staging acessível publicamente
**Owner: f0ntz | ETA: D30**

O hackathon pede "live deployed link (strongly encouraged)".
Sem link, o júri não testa.

```bash
# Railway (já tem config)
railway up --detach

# Ou Docker Compose na VPS
docker-compose up -d
```

Variáveis de ambiente precisam estar no Railway/VPS antes do deploy.

---

## P2 — Innovation (20%) — diferencial de pódio

### P2-01 — PQC na resposta do agente (ML-DSA-87)
**Owner: f0ntz | ETA: D01**

`pqc_receipt.py` já existe e está correto. Falta conectar ao fluxo do agente:

1. Em `creator_pay_tools.py` → executor `pay_creator_nanopayment`:
   - Após `ArcClient.transfer()` confirmar → chamar `sign_receipt()` com o payload
   - Adicionar `receipt_pqc` no `PaymentIntent` (campo já existe no modelo?)
2. Incluir `receipt_pqc` na resposta da `GET /v1/agent/run-campaign/{run_id}/status`
3. No vídeo: mostrar o campo `receipt_pqc` no JSON response — "pagamento com assinatura pós-quântica ML-DSA-87"

Verificar se `receipt_pqc` já está em `PaymentIntent` model:
```bash
grep -n "receipt_pqc\|pqc" backend/database/models.py
```

---

### P2-02 — CCTP no vídeo de demo
**Owner: f0ntz | ETA: D02**

`cctp_client.py` é completo e funcional com sandbox. No vídeo: mostrar
`POST /v1/arc/cctp/bridge` bridgeando USDC de Sepolia para Arc.
Não precisa ser transação live — sandbox com log bonito no terminal resolve.

---

### P2-03 — ERC-8004 agent identity (stretch)
**Owner: f0ntz | ETA: D03, só se P0+P1 estiverem verdes**

Se houver tempo: registrar o agente XiaoLee na rede Arc com identidade ERC-8004.
Só adiciona ao Innovation 20% — não bloqueia nada.

---

## P3 — Submissão (D05-D06)

### P3-01 — Vídeo demo ≤ 3min
**Owner: f0ntz + Mari | ETA: D04-D05**

Roteiro (story board):
1. **0:00–0:20** — problema: creators não recebem pelo conteúdo
2. **0:20–0:50** — XiaoLee: agente descobre creators → avalia → paga USDC sem fricção
3. **0:50–1:40** — demo ao vivo: `Run Agent` → 3 pagamentos USDC na tela → feed SSE atualiza
4. **1:40–2:10** — inovação: PQC receipt no JSON + CCTP bridge
5. **2:10–2:40** — tração: X creators, Y USDC pagos, dashboard ao vivo
6. **2:40–3:00** — call to action: GitHub + link live

Gravar no Loom (gratuito, link público imediato).

---

### P3-02 — README público mapeado aos critérios do hackathon
**Owner: Jeiel | ETA: D05**

O README precisa ter uma seção "How XiaoLee scores on Lepton criteria" **no topo**
(logo abaixo do título/tagline) — é o primeiro contato do júri, e se não for óbvio
em segundos como o XiaoLee mapeia os 4 critérios, o júri passa para o próximo projeto.

Bloco pronto para colar no README (paths já verificados contra o código em 01/jul):

```markdown
> **Live on Arc testnet:** X creators paid · $Y.YY USDC settled · avg latency Zms
> [Live demo](<URL>) · [Video demo](<LOOM_URL>) · [Submit form](https://forms.gle/SMqLaw2pMGDe58LFA)

## How XiaoLee scores on Lepton criteria

| Criterion | Weight | How XiaoLee addresses it | Evidence |
|---|---|---|---|
| **Agentic** | 30% | `ClaudeAgentEngine`: autonomous discover → evaluate → pay loop. No human in the loop — the agent decides which creators to pay and how much, within budget constraints. | `backend/claude_agent.py`, `POST /v1/agent/run-campaign` |
| **Traction** | 30% | Creators onboarded and USDC settled on Arc testnet during the event window, exposed live via a stats/feed API and Grafana dashboard. | `GET /v1/traction/stats`, `GET /v1/traction/feed` (SSE), `backend/server/traction_routes.py` |
| **Circle Tools** | 20% | Circle W3S developer wallets for USDC payouts, x402 HTTP 402 nanopayments on Arc, CCTP bridge to move USDC from Sepolia to Arc, App Kit for the frontend wallet. | `backend/server/integrations/arc_client.py`, `backend/server/routes/arc_x402_routes.py`, `backend/server/integrations/cctp_client.py` |
| **Innovation** | 20% | ML-DSA-87 (NIST FIPS 204) post-quantum signatures on every payment receipt, plus CCTP cross-chain funding and agent-to-agent identity (ERC-8004, stretch). | `backend/services/pqc_receipt.py`, `backend/server/routes/trust_routes.py` |

### Quick start for judges

\`\`\`bash
# x402 on Arc — should return HTTP 402 with "network":"arc","asset":"USDC"
curl -X POST https://<URL>/v1/arc/ai/query \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'

# Traction stats — creators paid, USDC settled, latency
curl https://<URL>/v1/traction/stats
\`\`\`
```

**Antes de colar no README:**
1. Preencher `<URL>` (link do deploy — depende de P1-04) e `<LOOM_URL>` (depende de P3-01)
2. Preencher X (creators) e $Y.YY (USDC settled) no banner — depende de P1-01/P1-02
3. Rodar os dois `curl` contra o staging real para confirmar que retornam o esperado antes de publicar

**Critério de aceite:**
- [ ] Seção "How XiaoLee scores on Lepton criteria" no topo do README
- [ ] Banner de tração com números reais (preencher após P1-01)
- [ ] Quick start com comandos curl que o júri pode executar
- [ ] Link para vídeo demo (preencher após P3-01)
- [ ] Link para formulário de submissão

---

### P3-03 — Submissão
**Owner: f0ntz | ETA: 6 jul antes das 20h ET**

- [ ] Repo GitHub público (sem secrets no histórico)
- [ ] Vídeo no Loom/YouTube (link público)
- [ ] Link live deployado
- [ ] Formulário: `forms.gle/SMqLaw2pMGDe58LFA`
- [ ] Métricas de traction capturadas (screenshots do dashboard + total USDC)

---

## Responsabilidades por pessoa

| Task | f0ntz | Jeiel | Mari |
|------|-------|-------|------|
| P0-01: Registrar arc_x402 | X | | |
| P0-02: Circle credentials | X | | |
| P0-03: Fix pytest env | X | | |
| P1-01: Primeira tx USDC real | X | X | |
| P1-02: Onboarding creators | | | X |
| P1-03: Dashboard ao vivo | | | X |
| P1-04: Deploy staging | X | | |
| P2-01: PQC no fluxo do agente | X | | |
| P2-02: CCTP no vídeo | X | | |
| P3-01: Vídeo demo | X | | X |
| P3-02: README público | | X | |
| P3-03: Submissão | X | | |

---

## Timeline comprimida (8 dias)

```
D29 (hoje dom)  f0ntz: P0-02 Circle credentials reais + P1-04 deploy staging
D30 (seg)       f0ntz+Jeiel: P1-01 primeira tx USDC real | Mari: P1-02 onboarding
D01 (ter)       Mari: P1-03 dashboard | f0ntz: P2-01 PQC no fluxo
D02 (qua)       Jeiel: loop a2a | f0ntz: P2-02 CCTP demo prep
D03 (qui)       integration freeze — tudo rodando junto no staging
D04 (sex)       buffer traction — mais creators, mais USDC fluindo
D05 (sáb)       f0ntz+Mari: vídeo roteiro + gravação | Jeiel: README
D06 (dom 5 jul) edição vídeo + dry-run submissão
D07 (seg 6 jul) SUBMISSÃO até 20h ET
```

---

## Critérios de sucesso (o que o júri precisa ver)

Para Grand Prize (1st — $10k):
- [x] Agente autônomo com loop real de decisão (não chatbot)
- [ ] 10+ transações USDC reais no testnet Arc durante o evento
- [ ] Dashboard ao vivo mostrando USDC fluindo
- [ ] x402 on Arc respondendo 402 → pagamento → 200
- [ ] PQC receipt no JSON de resposta
- [ ] CCTP demonstrado (mesmo em sandbox)
- [ ] Vídeo ≤ 3min com demo ao vivo
- [ ] README mapeado aos critérios

Para Standout ($650–750, mínimo aceitável):
- [x] Código funcionando com Circle tools
- [ ] Pelo menos 1 transação USDC real
- [ ] Vídeo demonstrando o loop
