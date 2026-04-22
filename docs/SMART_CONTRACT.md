# Documentacao de Smart Contracts (Solana/Anchor)

O motor financeiro da XiaoLee nao reside em bancos de dados tradicionais. Toda a "pontuacao" e o ecossistema financeiro estao hospedados de forma descentralizada na rede Solana.

O codigo on-chain esta em: `solana-program/xiaolee_core/programs/xiaolee_core/src/lib.rs`.

---

## 1. O Token-2022 ($XLEE)

O token utilitario do protocolo foi instanciado utilizando o padrao nativo **SPL Token-2022** da Solana.

### Configuracoes Atuais (Devnet)

| Parametro              | Valor                                            |
|------------------------|--------------------------------------------------|
| Mint Address           | `848Nf9WswGodWrrw61dWMtuBaEcJWm9wsuBS3P5m78J4` |
| Extensao               | `TransferFeeConfig`                              |
| Taxa de Transferencia  | **0.5%** (queima nativa em cada movimentacao)    |
| Padrao                 | SPL Token-2022 (Solana Program Library)          |

A extensao `TransferFeeConfig` e embutida diretamente na rede Solana. Sempre que o token e trocado de carteira ou swappado via Jupiter, a rede cobra e destroy automaticamente 0.5% do volume movido, tornando o $XLEE deflacionario sem necessidade de contratos adicionais.

---

## 2. O Programa: `xiaolee_core`

Este e o Smart Contract customizado via Anchor Framework. Ele gerencia as metricas de usuario on-chain.

| Parametro    | Valor                                              |
|--------------|----------------------------------------------------|
| Program ID   | `Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM`  |
| Framework    | Anchor v0.30                                       |
| Linguagem    | Rust                                               |
| Rede atual   | Solana Devnet                                      |

### Estruturas PDAs (Program Derived Addresses)

Usamos contas sem Private Keys gerenciadas diretamente pela logica do contrato.

#### `GlobalConfig`

| Campo | Tipo     | Descricao                                         |
|-------|----------|---------------------------------------------------|
| admin | `Pubkey` | Chave publica do administrador autorizado         |
| bump  | `u8`     | Bump seed para derivacao do PDA                   |

- **Seed:** `[b"global_config"]`
- **Proposito:** Armazena a Pubkey do Administrador. Apenas esta conta pode chamar rotas de atualizacao de pontuacao. O Admin e a carteira gerenciada pelo motor Python/Backend.

#### `UserState`

| Campo         | Tipo     | Descricao                                     |
|---------------|----------|-----------------------------------------------|
| twitter_id    | `String` | ID do Twitter do usuario (max 50 chars)       |
| swap_count    | `u64`    | Numero total de swaps realizados              |
| total_volume  | `u64`    | Volume total swappado em USDC (lamports)      |
| bump          | `u8`     | Bump seed para derivacao do PDA               |

- **Seed:** `[b"user", twitter_id.as_bytes()]`
- **Proposito:** Uma conta imutavel por usuario de rede social. Resolve o problema de linkar contas Web2 (Twitter) com estado Web3 (Solana).

---

## 3. Instrucoes (Functions)

### `initialize_global()`

Chamada **apenas 1 vez** durante o setup da Mainnet.

- Cria o `GlobalConfig` PDA.
- Seta quem sera a `admin` pubkey (wallet do Backend).
- **Restricao:** Idempotente — falha se ja existir.

### `initialize_user(twitter_id: String)`

Chamada quando um usuario usa a XiaoLee pela primeira vez.

- Cria a conta PDA de usuario.
- Custa uma pequena taxa de Rent (SOL) para quem invoca.
- **Seguranca:** Recusa a criacao se o `twitter_id` for maior que 50 caracteres (protecao de memoria contra exploits de alocacao excessiva).

### `record_swap(volume: u64)`

A rota principal de atualizacao do leaderboard on-chain.

- **Seguranca Maxima:** Somente pode ser executada se o assinante da transacao corresponder ao `admin` mapeado no `GlobalConfig`. Tentativa de bypass resulta em `ErrorCode::Unauthorized`.
- **Aritmetica Segura:** Usa `checked_add()` que retorna `ErrorCode::MathOverflow` em vez de panic silencioso em caso de volumes que ultrapassem o limite de u64.

---

## 4. Custom Error Codes

| Codigo                  | Descricao                                          |
|-------------------------|----------------------------------------------------|
| `Unauthorized`          | Assinante nao e o admin autorizado                 |
| `MathOverflow`          | Soma de volume ultrapassaria o limite u64          |
| `InvalidTwitterId`      | ID do Twitter excede 50 caracteres                 |

---

## 5. Rodando Testes

A seguranca e validada automaticamente via `ts-mocha` com `solana-test-validator` em background:

Cobertura de Testes On-Chain: [██████████] 100%

```bash
# Na raiz do projeto:
make test-anchor
```

Os testes cobrem:

| Cenario                                    | Status |
|--------------------------------------------|--------|
| Inicializacao do GlobalConfig              | OK     |
| Criacao de UserState (novo usuario)        | OK     |
| record_swap com admin autorizado           | OK     |
| record_swap com carteira nao-autorizada    | REJEITADO (esperado) |
| Tentativa de estouro aritmetico (overflow) | REJEITADO (esperado) |
| twitter_id com mais de 50 caracteres       | REJEITADO (esperado) |

---

## 6. Seguranca Pre-Mainnet

Antes de migrar para Mainnet, e obrigatorio:

1. Substituir o `Program ID` compilando para Mainnet via `anchor build --arch sbf`.
2. Trocar o cluster nas variaveis de ambiente de `devnet` para `mainnet-beta`.
3. Realizar auditoria de seguranca independente (recomendado: Trail of Bits, Certik, Sherlock).
4. Configurar bug bounty antes do launch.
5. Testar todos os fluxos com fundos reais minimos antes do deploy oficial.

```bash
# Exemplo de deploy Mainnet (apenas apos auditoria)
anchor deploy --provider.cluster mainnet-beta --provider.wallet ~/mainnet-wallet.json
```
