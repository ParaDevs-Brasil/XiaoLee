# 🚀 XiaoLee: Guia de Deploy em Mainnet (Fase 9)

Este guia define os passos exatos para colocar a plataforma XiaoLee 100% online em ambiente de produção (Mainnet), garantindo segurança e escalabilidade.

## 1. Secrets Vault & Variáveis de Ambiente

NUNCA armazene variáveis de ambiente de produção (como o `SOLANA_ADMIN_KEYPAIR_B58` ou `GEMINI_API_KEY`) diretamente no disco ou no `.env` sem proteção.

### Opção A: AWS Secrets Manager (Recomendado)
Se você estiver utilizando instâncias AWS EC2, configure o IAM Role para permitir acesso ao Secrets Manager. O Backend deve puxar os secrets via SDK da AWS durante o startup.

### Opção B: Doppler ou HashiCorp Vault
Sincronize os secrets de forma segura diretamente no build container usando as CLIs dessas ferramentas.

**Passo de Segurança**: Geração da Keypair do Admin (Cold Storage + Vault)
```bash
solana-keygen new --outfile admin-keypair.json
# Extrair o Base58 para o Vault
cat admin-keypair.json | python3 -c "import sys,json,base58; print(base58.b58encode(bytes(json.load(sys.stdin))).decode())"
# DELETE o arquivo JSON após backup seguro!
```

## 2. Deploy do Contrato Anchor (Mainnet-Beta)

1. **Atualize o RPC e Cluster**:
   Modifique o `Anchor.toml`:
   ```toml
   [provider]
   cluster = "Mainnet"
   wallet = "~/.config/solana/id.json"
   ```

2. **Certifique-se de que tem SOL para o rent exemption** (aprox. 3 SOL recomendados para deploy inicial).
3. **Faça o Deploy e Inicialize o Global Config**:
   ```bash
   anchor build
   anchor deploy --provider.cluster mainnet
   # Inicializar a configuração global on-chain
   anchor run initialize_global --provider.cluster mainnet
   ```

## 3. Hospedagem & HTTPS (Frontend + Backend)

### Opção A: Descentralizado (Vercel + EC2) - *Recomendado para escalabilidade*
- **Frontend**: Hospedado na Vercel (conecta nativamente com o repositório GitHub e configura HTTPS automático). Configurar variável `NEXT_PUBLIC_CORE_API_URL` apontando para o seu domínio do backend.
- **Backend/DB**: Hospedado em um EC2 da AWS ou DigitalOcean Droplet rodando `docker-compose up -d`.

### Opção B: VPS Única (Tudo em um EC2)
Se for hospedar tudo na mesma máquina, configure um Reverse Proxy (como o **Caddy** ou **NGINX**) para expor as portas 80/443 e configurar SSL automático.

**Exemplo de Caddyfile**:
```caddyfile
# Frontend
xiaolee.io {
    reverse_proxy localhost:3000
}

# Backend API
api.xiaolee.io {
    reverse_proxy localhost:8000
}
```

**Subindo a stack em Prod**:
```bash
XIAOLEE_ENV=production docker-compose -f docker-compose.yml up -d
```

## 4. Otimização de Banco de Dados

Substitua o PostgreSQL/Redis do `docker-compose.yml` por instâncias gerenciadas:
- **AWS RDS** (PostgreSQL 16)
- **AWS ElastiCache** (Redis)

Basta atualizar a `DATABASE_URL` e a `REDIS_URL` nos segredos para apontar para a AWS ao invés dos containers locais. Isso evita perdas catastróficas de dados caso o container caia e facilita o backup snapshot automático.

---
**Status Final**: Após seguir estes passos, a XiaoLee estará pronta para interações com dinheiro real. Acompanhe os logs via Grafana (porta 3001).
