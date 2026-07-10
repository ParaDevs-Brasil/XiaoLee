# Consistência & Melhoria — XiaoLee

Criado em: **2026-07-09**
Status: vivo — este doc é reverificado contra o código a cada rodada, não é uma foto única
Escopo: personalidade da IA (eixo 1) + consistência de produto/UX (eixo 2)

---

## 0. Como este documento funciona

Isso não é um plano estático — é o rastreador de consistência do XiaoLee. Regras de uso:

1. **Cada item tem um DoD (Definition of Done) checável.** Nada de "melhorar a personalidade" solto — cada linha do checklist tem que dar pra marcar sim/não olhando o código ou testando na mão.
2. **Toda vez que alguém (Gustavo, Claude, o time) reabrir este doc para trabalhar em um item, revalida contra o código atual antes de confiar no status** — memórias e docs anteriores no repo já provaram que ficam obsoletos rápido (ver `SPRINT_STATUS.md`).
3. **Tabela de status (seção 1 e 2) usa RAG:** 🔴 não iniciado / 🟡 em andamento ou parcialmente verificado / 🟢 DoD cumprido e verificado.
4. **Todo update relevante vai para o Log (seção 5)** — data, o que mudou, quem/o que verificou.
5. Este doc **não duplica** planos de UX já existentes (`FRONTEND_CONSISTENCY_PLAN.md`, `ROADMAP_INTEGRACAO_FRONTEND.md`) — ele referencia e adiciona uma camada de DoD/rastreamento por cima.

---

## 1. Eixo 1 — Personalidade da IA (a "waifu fofa e esperta")

### 1.1 Diagnóstico (verificado em 2026-07-09, direto no código)

O motivo da personalidade ter "sumido" não é impressão — é rastreável. Existem **três definições de persona diferentes no código, e a única que está de fato no ar não define personalidade nenhuma**:

| Arquivo | Conteúdo | Está no ar? |
|---|---|---|
| `backend/ai/prompts.py::get_base_system_prompt()` | Versão mais rica: flerte leve, "degen culture" (bags/moon/wagmi), `play_animation` obrigatório em quase toda resposta | **Não.** `grep` não encontra nenhum caller — código morto desde o commit inicial. |
| `backend/ai/response_generator.py::_build_dynamic_system_prompt()` (+ toda a classe `ResponseGenerator`) | Versão intermediária: "cheerful crypto waifu", emojis, mas sem flerte/degen; `play_animation` restrito a "hello/celebration only" | **Não.** `ResponseGenerator` só é importado por `backend/flask_api/*`, que é o app Flask legado — não roda em nenhum lugar (`Makefile`, `railway.toml`, Dockerfile só sobem `server.app:app` via uvicorn). |
| `backend/server/orchestration/service.py::_build_agentic_system_prompt()` + `_PLATFORM_CONTEXT` | Descreve capacidades técnicas (Arc, CCTP, x402, PQC) em tom neutro. Diz literalmente "responda com sua personalidade" **sem nunca definir essa personalidade** — zero menção a tom, emojis, cheerful, flerte, nada. | **Sim.** `app.py:270` instancia `OrchestrationService`, e `/chat` (endpoint que o frontend usa), o webhook do Telegram e o poller do Twitter passam todos por `_process_inbound → orchestrator.execute()`. Esse é o único caminho vivo. |

**Conclusão:** a persona rica foi escrita duas vezes (com força decrescente) e nenhuma das duas versões acompanhou o pivot pra arquitetura Arc/multi-chain (commit `6fa44c0`, "persona por wallet"). O prompt que está de fato respondendo hoje não tem nenhuma instrução de tom — o "cheerful bubbly waifu" que sobrou é só o que o modelo infere do nome "XiaoLee" sozinho, sem reforço. Prova extra encontrada no próprio código: o handler de `greeting` (linha ~938) já dizia "Dê as boas-vindas **com a personalidade completa da XiaoLee**" — uma referência a uma personalidade que, até esta correção, nunca tinha sido de fato definida em nenhum prompt vivo.

Achados secundários:
- **Não é um só modelo — são dois, mas não em partes iguais.** Correção sobre uma nota anterior deste doc: `execute()` tenta o loop agentic do Claude (`_execute_agentic`/`ChatAgentEngine`, Claude Sonnet 4.6) **primeiro, por padrão**, para qualquer mensagem — só desvia pra Gemini quando `_detect_arc_intent()` reconhece um dos poucos padrões determinísticos bem específicos (pagar creator, descobrir creators, rodar campanha do agente, "check budget"/orçamento) **ou** quando a chamada ao Claude lança exceção (fallback de erro). Ou seja: `self.gemini.generate_reply()` não é "a maioria das conversas" — é uma rota estreita para um punhado de intents do agente Arc/Circle mais um fallback de indisponibilidade. Na prática, saudação, perguntas gerais, saldo e swap (o grosso do volume de chat) passam pelo Claude. Isso foi confirmado testando as 5 mensagens do DoD: todas bateram no mesmo caminho (`_execute_agentic`). A base `_PLATFORM_CONTEXT` é compartilhada pelos dois (17 pontos de uso no arquivo), então mesmo a fatia menor que usa Gemini já herda a correção de tom.
- **O sistema de animação visual está 100% desconectado, não só subutilizado.** `play_animation` (`backend/ai/mcp_tools.py`) tem descrição restritiva (*"Do NOT use for educational responses or general conversations"*) **e nem está na lista de tools do caminho vivo** (`STELLAR_AGENT_TOOLS` em `orchestration/service.py` só tem `arc_get_usdc_balance`, `stellar_get_balance`, `stellar_swap_quote`). Pior: o endpoint `/chat` (`app.py`) retorna `"animations": None` **hardcoded**, sempre — mesmo que o backend algum dia chame a tool. O frontend (`ChatPanel.tsx:229`, `Video.tsx`, `MiniAvatar.tsx`) já tem toda a lógica pronta pra tocar os vídeos (`response.animations !== null` → `Video.setPfp(...)`), só nunca recebe o sinal. Os 13 assets (`frontend/public/xiaolee_*.mov|mp4`: Hello, Kawaii, Love, Cheer, Giggle, Salute, Ouch, Uncomfortable, Surprise, ThinkLow + standbys) estão intactos, esperando. **Isso é um item separado do DoD (1.2), ainda não corrigido nesta rodada** — é sobre expressão visual, não sobre o texto do prompt.
- Não há fragmentação entre canais (web/Telegram/Twitter) — todos passam pelo mesmo `OrchestrationService`, então corrigir o prompt ali corrige os três de uma vez.

### 1.1.1 Correção aplicada em 2026-07-09

Editado `_PLATFORM_CONTEXT` em `backend/server/orchestration/service.py` — adicionado um bloco `PERSONALITY:` fundindo o tom da versão rica (`prompts.py`, código morto): cheerful, bubbly, flerte leve, degen culture opcional (bags/moon/wagmi), emojis com moderação, sem markdown/asteriscos, respostas concisas. O restante do bloco (capacidades técnicas Arc/CCTP/x402/PQC, regras de wallet/chain) foi mantido palavra por palavra — só a camada de tom foi adicionada por cima.

**Validado manualmente** (backend local, 5 mensagens variadas via `/chat`): saudação casual, pergunta sobre campanhas/$XLEE, pergunta técnica sobre CCTP em inglês, saldo sem wallet conectada, saldo com wallet conectada (aciona o loop agentic do Claude). Tom cheerful/warm consistente nas 5, em PT-BR e EN, sem exagero de emoji, explicações técnicas mantidas precisas. Suite completa do backend rodada (`pytest tests/`): **450 passed, 6 skipped**, zero regressão.

Único ponto observado sem ser bloqueante: a resposta do caminho Claude/agentic (saldo com wallet conectada) usou `**negrito**` markdown apesar da instrução de evitar — o texto de `_PLATFORM_CONTEXT` chega no Claude, mas o hábito de bold pode precisar de reforço extra nesse caminho especificamente. Não corrigido ainda, fica registrado para não perder o achado.

### 1.1.2 Animações reconectadas (2026-07-09)

Antes de reconectar, validado com o Gustavo que isso não afeta o layout responsivo do front (feito pela Mari): `AnimePanel` (painel grande, só desktop — `hidden lg:flex`) e `MiniAvatar` (avatar pequeno no header, só abaixo de `lg`) são componentes visuais diferentes, mas **os dois escutam o mesmo serviço singleton `Video`** (`frontend/src/components/Video.tsx`, via `Video.subscribe`/`Video.setPfp`). Reconectar o sinal do backend não toca nenhum arquivo de layout/breakpoint — só faz `Video.setPfp(...)` receber chamadas reais em vez de nunca ser invocado por esse caminho.

Achados que precisaram de correção antes de religar (a razão de checar antes de agir):
1. **Bug de typo no front:** `ChatPanel.tsx` mapeava `Uncomfortable` para o arquivo `xiaolee_unconfortable.mov`, mas o arquivo real é `xiaolee_uncomfortable.mov`. Corrigido (1 linha).
2. **Catálogo do backend maior que o suportado pelo front:** `config.py::ACTION_VIDEO_MAP` tem aliases (`Happy`, `Excited`, `Confused`, `Thinking`, `Standby*`, `wave`) que o front não tem no seu mapa `actions`. Em vez de inflar o front pra cobrir tudo, restringi o enum exposto ao modelo no caminho vivo a exatamente os 10 nomes que o front já suporta corretamente (`_ANIMATION_NAMES` em `orchestration/service.py`) — menor superfície, sem inventar cobertura nova.

Mudanças feitas:
- `backend/server/orchestration/service.py`: adicionada a tool `play_animation` a `STELLAR_AGENT_TOOLS` (antes só tinha `arc_get_usdc_balance`, `stellar_get_balance`, `stellar_swap_quote` — a tool nem estava disponível no caminho vivo); executor captura `animation_name` e injeta em `execution["animation"]`; `_build_agentic_system_prompt` ganhou uma linha descrevendo quando usar a tool.
- `backend/server/app.py`: `/chat` não retorna mais `"animations": None` hardcoded — agora lê `result.execution.get("animation")`.
- `frontend/src/components/ChatPanel.tsx`: typo corrigido (`Uncomfortable`).

**Validado**: suite completa (`pytest tests/`, 450 passed / 6 skipped) + teste manual real via `/chat` local (backend rodando, chamada de verdade ao Claude):
- Saudação ("oii, bom dia!") → `execution.animation = "Hello"`, `animations: "Hello"` na resposta.
- Saldo com wallet conectada → `execution.animation = "Cheer"`, `animations: "Cheer"` na resposta.

Ambos os nomes batem com chaves existentes no `actions` do front, então `Video.setPfp` resolve para um arquivo real dos dois lados (`AnimePanel` e `MiniAvatar`).

**Escopo intencionalmente não coberto nesta rodada:** a fatia de conversa que passa pelo Gemini (`generate_reply`, ver 1.1.1) não tem tool-calling — não recebe sinal de animação. Como essa fatia é pequena (intents específicas do agente Arc/Circle + fallback de erro, não o grosso do chat), ficou de fora por ora; se quiser cobertura ali também, precisa de uma abordagem diferente (heurística por intent, já que `generate_reply` não suporta tools hoje).

### 1.1.3 Reconciliação com `origin/main` (2026-07-09, antes do commit)

Antes de commitar, descoberto que a branch local (`feature/f0ntz-trust-arc-live`) estava **5 commits atrás** de `origin/main` — e 3 deles no mesmo `_PLATFORM_CONTEXT`/`STELLAR_AGENT_TOOLS` que esta sessão editou:

- `8df6c69` (6 jul, Gustavo) — **já tinha corrigido o mesmo problema de tom**, e de forma mais completa que a edição inicial desta sessão: bane `##`/`---`/tabelas/menu de bullet points, regra explícita de anti-alucinação de saldo/tx hash, respostas curtas (1-4 frases). Confirma o diagnóstico de 1.1 (o prompt vivo não tinha tom) e mostra que já tinha sido identificado e corrigido de forma independente 3 dias antes desta sessão.
- `78e6340` + `bdc0bf8` — tool `list_campaigns` cabeada no agente Claude, com regra anti-catálogo (respostas de lista viram prosa corrida, não bullet list).

**Reconciliação feita:** `git merge --ff-only origin/main` pra trazer os 5 commits, depois reaplicado o trabalho desta sessão (stash) por cima. Na versão de `_PLATFORM_CONTEXT`, a base de `8df6c69` foi mantida (é mais completa e já testada) e só a camada flerte/degen (`"A little flirty and degen at heart..."`) foi inserida por cima, sem remover nenhuma das regras anti-markdown/anti-alucinação já existentes. A tool `play_animation` (trabalho novo, sem equivalente em `origin/main`) foi adicionada à lista já existente (que agora também tem `list_campaigns`). `ChatPanel.tsx` também tinha uma mudança de outro commit (`e250a33`, fallback de gas EIP-1559) em linhas diferentes — sem conflito real, mesclou limpo.

Revalidado depois da reconciliação: suite completa (450 passed / 6 skipped) + teste manual via `/chat` (saudação → tom curto/caloroso + animação Hello; pergunta sobre campanhas → `list_campaigns` respondendo em prosa corrida, não catálogo).

### 1.2 DoD — Eixo 1

- [ ] **Fonte única de verdade.** Existe um só lugar no código que define a personalidade do Xiao Lee (tom, emojis, limites do flerte, vocabulário). As outras duas definições (`prompts.py::get_base_system_prompt`, `response_generator.py` inteiro) foram removidas ou explicitamente arquivadas com comentário indicando que é legado morto — não deixadas "por via das dúvidas" competindo silenciosamente. *(Ainda pendente — o texto foi fundido em `_PLATFORM_CONTEXT`, mas o código morto original ainda existe no repo, só não compete mais de fato.)*
- [x] **`_PLATFORM_CONTEXT`/`_build_agentic_system_prompt` (o caminho vivo) inclui definição explícita de tom** — cheerful, bubbly, emojis, flerte leve e degen culture opcional. Feito em 2026-07-09 (ver 1.1.1).
- [x] **`play_animation` reconectado no caminho vivo** — tool adicionada a `STELLAR_AGENT_TOOLS`, executor capturando `animation_name`, `/chat` não zera mais `animations`. Validado com 2 chamadas reais (Hello/Cheer). Feito em 2026-07-09, ver 1.1.2. *(Cobertura parcial: só no caminho Claude, não no Gemini — ver nota de escopo em 1.1.2.)*
- [x] **Teste manual de consistência**: 5 mensagens variadas testadas em 2026-07-09 (saudação casual, campanhas/$XLEE, pergunta técnica CCTP em EN, saldo sem wallet, saldo com wallet via loop agentic) — tom consistente nas 5. Ver 1.1.1.
- [ ] **Persona idêntica nos 3 canais** (web chat, Telegram, Twitter) — a correção propaga por compartilhar `_PLATFORM_CONTEXT`, mas só foi testada via `/chat` (web). Telegram/Twitter ainda não testados manualmente nesta rodada.
- [ ] `flask_api/` (app Flask legado morto) — decisão explícita: deletar do repo ou deixar documentado como arquivado, para não confundir a próxima pessoa que fizer `grep` por "personality" e cair nele achando que é o caminho vivo (foi exatamente o que aconteceu nesta análise).

**Status:** 🟡 em andamento — tom principal corrigido e validado, animações reconectadas no caminho Claude; falta decidir destino do código morto, cobrir o caminho Gemini, e testar Telegram/Twitter.

---

## 2. Eixo 2 — UX / Consistência de produto

Este eixo **não recomeça do zero** — já existem dois planos no repo:

- `docs/FRONTEND_CONSISTENCY_PLAN.md` (30 jun) — consistência visual (landing como referência de design system, ícones, breakpoints, i18n). 6 fases definidas, status "proposta / aguardando execução" na última verificação.
- `docs/ROADMAP_INTEGRACAO_FRONTEND.md` (4 jul, pós c8bf280) — o que o front ainda não consome do backend novo (Arc x402, treasury CCTP, recibos PQC) e o legado Stellar/Phantom a aposentar. Escrito com o deadline do Lepton (6 jul) em mente — **esse deadline já passou (hoje é 9 jul)**, então a priorização por "o que o juiz precisa ver" desse doc está desatualizada; os gaps técnicos listados nele continuam válidos, só a urgência/ordem muda.

Este eixo aqui serve pra **rastrear o DoD** desses dois planos e registrar o que muda depois da última verificação registrada neles (5-6 jul), incluindo o fato de que agora **frontend deixou de ser só domínio da Mari** — o time inteiro (Gustavo incluso) pode mexer, então esse doc para de tratar frontend como "só flag leve".

### 2.1 Estado na última verificação (herdado da memória de sessões anteriores, 4-6 jul — precisa revalidação)

- Gaps de contrato front↔backend (`POST /v1/creator/register` 422 com 0x, `POST /campaigns/claim` sem verificação EVM) — **relatados como resolvidos em 5 jul** (commits `caa3819` + `b8f8bc8`), claim validado ao vivo. **Revalidar** antes de assumir que segue assim, branch pode ter avançado.
- Rotas novas do backend ainda não consumidas pelo front (verificar se mudou desde 4 jul):
  1. `/v1/arc/ai/query` + `/query/payment-info` + `/query/verify-transfer` — x402 na Arc (o chat ainda paga via `/v1/ai/query`, variante Stellar).
  2. `/v1/arc/wallet`, `/wallet/balance`, `/cctp/bridge`, `/cctp/status/{hash}`.
  3. `/v1/cctp/treasury/{chain}/balance`.
  4. `/v1/trust/public-key` + `/v1/trust/verify-receipt` (recibos PQC ML-DSA-87) — bom candidato a badge "recibo verificado" no feed de traction.
  5. `/v1/agent/runs` (listagem, hoje só individual).
- Legado a aposentar: `utils/stellar.ts` inteiro, `StellarWallet.tsx` sem referência, `useXiaoLeeProgram.ts` (Solana), claim via Phantom `signMessage` (substituído por EIP-191 conforme os gaps acima).

### 2.2 DoD — Eixo 2

- [ ] `FRONTEND_CONSISTENCY_PLAN.md` fases 1-6 com status individual atualizado (o doc original não tem checklist de status por fase — adicionar).
- [ ] Cada rota nova listada em 2.1 tem uma decisão registrada: expor no front agora / depois / não expor — não fica indefinida.
- [ ] Legado Stellar/Phantom com decisão explícita por item (manter como fallback, migrar, remover) — não deixar código morto acumulando como aconteceu no eixo 1.
- [ ] Golden path manual sem quebra: login → conectar wallet → chat → ver saldo → participar de campanha → claim/payout. Rodado depois de qualquer mudança de UX, não só no fim.
- [ ] Nenhuma mudança de consistência introduz trade-off que quebre um fluxo existente sem aviso prévio registrado no Log (seção 5) — essa é a régua que Gustavo pediu: consistência sim, quebra não.

**Status:** 🟡 em andamento — bases mapeadas em planos anteriores, mas sem revalidação nem DoD até agora.

---

## 3. Modelo de DoD reutilizável

Para qualquer item novo que entrar neste doc, seguir este template:

```
### <nome do item>
- Contexto: <por que isso importa, 1-2 frases>
- Critérios de DoD:
  - [ ] <critério verificável 1>
  - [ ] <critério verificável 2>
- Esforço: baixo / médio / alto
- Risco se não fizer: <consequência concreta>
- Última verificação: <data> — <quem/o que verificou, ex: "Claude, grep + leitura de código">
```

Critério de bom DoD: se alguém sem contexto nenhum consegue olhar o item e checar sim/não sem perguntar "o que isso quer dizer", o critério está bom. Se depende de opinião ("ficou mais bonito"), reescrever.

---

## 4. Riscos / o que não fazer

- **Não** apagar código sem antes confirmar que é mesmo morto (o próprio eixo 1 é prova de que "parece não usado" merece um `grep` antes de decidir — mas depois de confirmado morto, apagar, não deixar acumulando).
- **Não** tratar este doc como substituto do `FRONTEND_CONSISTENCY_PLAN.md`/`ROADMAP_INTEGRACAO_FRONTEND.md` — ele referencia, não duplica. Se um DoD de UX exigir detalhe de execução, o detalhe mora nos docs originais.
- **Não** prometer que a correção do eixo 1 (personalidade) é só "editar um texto" — é editar um texto, mas em um lugar que serve três canais de produção (web/Telegram/Twitter), então qualquer mudança de tom pede o teste manual do DoD antes de dar como pronto.
- **Não** reintroduzir uma quarta fonte de verdade pro prompt de personalidade ao "só adicionar uma variação rápida" em algum lugar novo — se motivo for específico de canal, resolver com contexto injetado, não com um novo bloco de tom paralelo.

---

## 5. Log de atualizações

| Data | O que mudou | Verificado por |
|---|---|---|
| 2026-07-09 | Doc criado. Diagnóstico completo do eixo 1 (3 prompts concorrentes, só 1 vivo e sem persona definida). Eixo 2 herdado de memória de sessões anteriores (4-6 jul), ainda não revalidado nesta sessão. | Claude — leitura direta de `backend/ai/prompts.py`, `backend/ai/response_generator.py`, `backend/server/orchestration/service.py`, `backend/server/app.py`, `backend/ai/mcp_tools.py`, `frontend/public/`, `.env`, `Makefile`/`railway.toml` |
| 2026-07-09 | Persona fundida em `_PLATFORM_CONTEXT` (`orchestration/service.py`). Achado adicional grave: sistema de animação 100% desconectado (`animations: None` hardcoded em `/chat`, tool fora do `STELLAR_AGENT_TOOLS`), não só "subutilizado" como o diagnóstico inicial sugeria. Suite completa rodada: 450 passed / 6 skipped. Teste manual com 5 mensagens variadas confirmou tom consistente. | Claude — edição em `backend/server/orchestration/service.py`, `pytest tests/` completo, `curl /chat` local com 5 mensagens (PT-BR + EN, com e sem wallet) |
| 2026-07-09 | Correção de rota: `execute()` usa o loop Claude por padrão pra quase tudo — Gemini só entra em intents Arc/Circle bem específicas (pagar/descobrir creator, rodar agente, budget) ou como fallback de erro. Nota anterior ("2 modelos, Gemini na maioria") estava imprecisa, corrigida. | Claude — leitura de `_detect_arc_intent`/`execute()`, confirmado testando as 5 mensagens do DoD (todas bateram em `_execute_agentic`) |
| 2026-07-09 | Animações reconectadas no caminho Claude: `play_animation` adicionada a `STELLAR_AGENT_TOOLS`, executor capturando `animation_name` → `execution["animation"]`, `/chat` parou de zerar `animations`. Corrigido também um typo pré-existente no front (`ChatPanel.tsx`: `xiaolee_unconfortable.mov` → `xiaolee_uncomfortable.mov`) e restringido o enum exposto ao modelo aos 10 nomes que o front já suporta (evita expor aliases do backend sem cobertura no front). Validado: suite completa (450 passed) + 2 chamadas reais via `/chat` (saudação → Hello, saldo → Cheer). Confirmado antes de mexer que `AnimePanel` (desktop) e `MiniAvatar` (mobile) escutam o mesmo singleton `Video`, então a mudança de backend não toca o layout responsivo da Mari. | Claude — edição em `orchestration/service.py`, `app.py`, `ChatPanel.tsx`; `pytest tests/` completo; `curl /chat` local com backend real |

---

## 6. Resumo executivo

A personalidade "sumiu" porque o prompt que está de fato no ar (`_PLATFORM_CONTEXT`, base do loop agentic do Claude, que responde à maioria das mensagens) nunca ganhou definição de tom depois do pivot pra Arc — as duas versões ricas da persona (`prompts.py`, `response_generator.py`) ficaram presas em código morto (a segunda inteira dentro de um app Flask legado que não roda mais). Não é regressão de modelo, é prompt que não acompanhou a arquitetura. **Corrigido em 2026-07-09**: tom fundido em `_PLATFORM_CONTEXT`, validado com 5 mensagens variadas e suite completa (450 passed). **Também em 2026-07-09**: sistema de animação reconectado (estava 100% desligado, não só subutilizado) — `play_animation` agora disponível no loop vivo, `/chat` para de zerar `animations`, validado com chamadas reais (Hello/Cheer). Confirmado que isso não afeta o layout responsivo que a Mari construiu (`AnimePanel`/`MiniAvatar` já compartilhavam o mesmo serviço `Video`) — mas 2 bugs pré-existentes no front (typo de arquivo, catálogo maior que o suportado) precisaram ser corrigidos antes, prova de que valeu a pena checar antes de religar o sinal.

Pendências que ficaram no eixo 1: decidir o destino do código morto (`prompts.py`, `response_generator.py`, `flask_api/`), cobrir o caminho Gemini de animação (hoje só o Claude reage — Gemini atende uma fatia menor de intents Arc específicas e não tem tool-calling), e testar a persona em Telegram/Twitter (só validada via web até agora). O eixo 2 (UX) já tem dois planos escritos — o trabalho ali é dar DoD e revalidação, não recriar. Próximo passo natural: decidir o destino do código morto (item 1 do DoD do eixo 1) — é o que fecha a "fonte única de verdade" da persona.
