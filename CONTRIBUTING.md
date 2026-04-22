# Como Contribuir para a XiaoLee

Bem-vindo! Este documento e o Ponto de Partida Definitivo para configurar seu ambiente local e comecar a contribuir com o protocolo XiaoLee.

---

## Pre-requisitos do Sistema

Para rodar todo o ecossistema (Backend, Frontend e Blockchain):

| Ferramenta               | Versao Minima | Uso                                 |
|--------------------------|---------------|-------------------------------------|
| Docker & Docker Compose  | 24+           | Containers de servicos              |
| Node.js & NPM            | 18+           | Frontend Next.js e testes Anchor    |
| Python                   | 3.12+         | Backend FastAPI                     |
| Rust & Cargo             | 1.75+         | Compilacao de Smart Contracts       |
| Solana CLI               | 1.18+         | Ferramentas de rede Solana          |
| Anchor CLI               | 0.30+         | Framework de Smart Contracts        |

### Instalando Rust e Solana CLI

```bash
# Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Instalar Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Instalar Anchor via AVM
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.0
avm use 0.30.0
```

---

## Onboarding Rapido

### 1. Clonar e Configurar

```bash
git clone https://github.com/ParaDevs-Brasil/XiaoLee.git
cd XiaoLee

# Configurar variaveis de ambiente
cp .env.example .env
# Preencha obrigatoriamente: GEMINI_API_KEY, HELIUS_API_KEY
```

### 2. Modo Desenvolvimento (Local Nativo)

Roda o FastAPI com hot-reload e o Next.js em modo dev simultaneamente:

```bash
make dev
```

| Servico   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000        |
| Backend   | http://localhost:8000        |
| API Docs  | http://localhost:8000/docs   |

### 3. Modo Producao (Docker)

Todos os servicos em containers isolados:

```bash
make build-docker
make run-docker
```

| Servico    | Porta | URL                       |
|------------|-------|---------------------------|
| Frontend   | 3000  | http://localhost:3000     |
| Backend    | 8000  | http://localhost:8000     |
| Prometheus | 9090  | http://localhost:9090     |

Para parar: `make stop-docker`

---

## Estrutura de Branches

```
main          # Branch de producao (protegida)
develop       # Branch de integracao
feat/*        # Novas funcionalidades
fix/*         # Correcoes de bugs
docs/*        # Atualizacoes de documentacao
chore/*       # Manutencao (deps, config)
```

---

## Padroes de Commit (Conventional Commits)

```
feat: adiciona endpoint POST /campaigns/create
fix: corrige overflow no contrato anchor record_swap
docs: atualiza referencia da API com campanhas
chore: remove pywin32 do requirements.docker.txt
refactor: extrai campaigns_routes para arquivo separado
test: adiciona cenario de hacker no anchor test suite
```

---

## Regras de Desenvolvimento

### Backend (Python / FastAPI)

1. Novas rotas devem ser criadas em arquivos de router separados (`*_routes.py`).
2. Schemas devem usar **Pydantic v2** com tipos estritos.
3. Nunca commitar `GEMINI_API_KEY` ou `HELIUS_API_KEY` no codigo.
4. Novos endpoints devem ser documentados no `docs/API_REFERENCE.md`.

### Frontend (Next.js / TypeScript)

1. Interfaces TypeScript devem ser definidas em `src/interfaces/` e espelhar exatamente o schema da API.
2. Chamadas de API centralizar via `src/api/api.tsx` (instancia Axios com baseURL configuravel).
3. Antes de fazer fetch com um ID de usuario, **sempre validar** que o ID nao esta vazio (veja `UserData.fetchData()`).
4. Novos hooks em `src/hooks/` devem ter tratamento de erro e loading state.

### Smart Contracts (Rust / Anchor)

1. Nunca use `.unwrap()` em aritmetica. Sempre retorne custom errors (`ErrorCode::MathOverflow`).
2. Novas instrucoes devem ter verificacoes estritas de controle de acesso (`has_one = admin`).
3. Teste todos os vetores de ataque conhecidos (contas nao-autorizadas, overflows).
4. Documente a nova instrucao no `docs/SMART_CONTRACT.md`.

---

## Rodando os Testes

### Testes do Smart Contract (Anchor)

```bash
make test-anchor
# ou equivalente:
cd solana-program/xiaolee_core
anchor test
```

### Testes E2E do Backend

Simula payloads de webhook do Telegram e X, validando todos os endpoints:

```bash
make e2e-tests
```

### Teste de Stress (Locust)

Para validar performance sob carga:

```bash
make stress-test
```

---

## Abrindo um Pull Request

1. Fork o repositorio e crie uma branch a partir de `develop`.
2. Implemente sua mudanca seguindo os padroes acima.
3. Rode todos os testes relevantes localmente.
4. Atualize a documentacao impactada.
5. Abra o PR com descricao clara do que foi feito e por que.
6. Aguarde revisao de pelo menos 1 maintainer.

---

## Variaveis de Ambiente Obrigatorias

| Variavel               | Descricao                                    | Exemplo                  |
|------------------------|----------------------------------------------|--------------------------|
| `GEMINI_API_KEY`       | Chave da API Google Gemini                   | `AIzaSy...`              |
| `HELIUS_API_KEY`       | Chave da API Helius (RPC Solana)             | `your_helius_key`        |
| `HELIUS_WEBHOOK_SECRET`| Secret para validar webhooks Helius (HMAC)  | `random_secret_string`   |
| `NEXT_PUBLIC_CORE_API_URL` | URL base da API para o frontend          | `http://localhost:8000`  |
| `SOLANA_RPC_URL`       | URL do no RPC Solana                         | `https://devnet.helius-rpc.com/?api-key=...` |

Veja o arquivo `.env.example` na raiz do projeto para o template completo.
