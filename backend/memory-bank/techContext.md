# Tech Context: Xiaolee

## 1. Tecnologias Principais

- **Framework Frontend:** Next.js 15.3.3
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS v4
- **Gerenciador de Pacotes:** npm
- **Controle de Versão:** Git (inicializado pelo create-next-app)
- **Servidor de Imagens:** Next.js Image Optimization (para `next/image`)

## 2. Configuração do Ambiente de Desenvolvimento

- **Node.js:** Versão LTS recomendada ou mais recente.
- **Editor de Código:** VS Code (recomendado, com extensões para TypeScript, ESLint, Prettier, Tailwind CSS IntelliSense).
- **Comandos Comuns:**
  - `npm run dev`: Iniciar servidor de desenvolvimento.
  - `npm run build`: Gerar build de produção.
  - `npm start`: Iniciar servidor de produção.
  - `npm run lint`: Rodar ESLint.

## 3. Restrições Técnicas

- (A serem identificadas, se houver).

## 4. Dependências Chave (Principais)

- `next@15.3.3`
- `react@^19.0.0`
- `react-dom@^19.0.0`
- `tailwindcss@^4` (configurado com `@tailwindcss/postcss` e `tailwind.config.ts`)
- `typescript@^5`
- `@types/react@^19`, `@types/node@^20`, `@types/react-dom@^19`
- `eslint@^9`, `eslint-config-next@15.3.3`

## 5. Padrões de Uso de Ferramentas

- **ESLint:** Para linting de código TypeScript/JavaScript.
- **Tailwind CSS IntelliSense (Extensão VS Code):** Para autocompletar classes do Tailwind.
- **`next/image`:** Para otimização de imagens (ex: `animeGirl.png`).
- **Estrutura de Pastas:**
    - `src/app/`: Para rotas e layouts (App Router).
    - `src/components/`: Para componentes reutilizáveis da UI.
    - `src/assets/`: Para imagens estáticas e outros assets.
    - `memory-bank/`: Para documentação do projeto. 