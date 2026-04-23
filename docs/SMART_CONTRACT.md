# XiaoLee Smart Contract e Integracao On-chain

Atualizacao documental: **2026-04-23**.

## 1. Estado Atual

O projeto possui base para smart contract em `solana-program/`, porem o fluxo principal do MVP em uso hoje e:

1. Backend prepara transacao de swap unsigned.
2. Frontend simula e exige confirmacao explicita.
3. Wallet do usuario assina e envia para Solana.
4. Helius envia webhook de resultado para o backend.
5. Backend atualiza historico e notificacoes.

Isso entrega UX de swap funcional em Devnet sem custodia de chave privada no backend.

## 2. Integracoes Solana ja ativas

- Solana Devnet para execucao de transacoes.
- Jupiter para quote e montagem da transacao de swap.
- Helius webhook para reconciliacao de status.

## 3. Programa proprio (Anchor)

Objetivo arquitetural do modulo on-chain proprio:

- Registrar eventos/metricas relevantes de forma auditavel.
- Garantir politicas de autorizacao para escrita de estado.
- Apoiar mecanicas de campanha e recompensa com rastreabilidade.

Status atual: **parcial**. A trilha principal de entrega ainda e wallet-first com reconciliacao off-chain.

## 4. Token e Enderecos

Existem referencias de token e program id em documentacao historica, mas a operacao atual deve ser tratada como ambiente de desenvolvimento/Devnet ate validacao final de release.

## 5. Progresso de Construcao (On-chain)

| Item | Status |
|---|---|
| Fluxo swap wallet-first em Devnet | Concluido |
| Webhook Helius para status | Concluido |
| Programa Anchor no caminho critico | Parcial |
| Hardening de producao mainnet | Pendente |
| Auditoria externa | Pendente |

## 6. Requisitos antes de Mainnet

1. Revisar constraints e authorities do programa Anchor.
2. Garantir idempotencia no processamento de eventos on-chain.
3. Cobrir cenarios de replay e falhas de reconciliacao.
4. Executar auditoria de seguranca independente.
5. Definir plano de rollout e rollback.

Classificacao correta no momento: **MVP/Devnet em evolucao**.

## 7. Testes e Status Operacional

- O fluxo principal validado hoje é wallet-first no frontend.
- O backend já reconcilia eventos de swap via webhook Helius e persiste notificações.
- A trilha de Anchor permanece como evolução planejada, não como caminho crítico do MVP.
