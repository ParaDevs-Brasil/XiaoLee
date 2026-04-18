# System Patterns: Xiaolee

## 1. Arquitetura do Sistema (Visão Atual)

- **Frontend:** Aplicação Next.js (React) com App Router.
- **Estilização:** Tailwind CSS v4.
- **Linguagem Principal:** TypeScript.
- **Estrutura da UI Principal (Página de Chat):**
    - `Navbar`: Barra de navegação superior.
    - `AnimePanel`: Painel lateral esquerdo para visualização da personagem.
    - `ChatPanel`: Painel central para interação de chat.
- **Componentização:** A UI será construída com componentes React reutilizáveis localizados em `src/components/`.

## 2. Decisões Técnicas Chave

- Utilização do App Router do Next.js para estrutura de rotas e layouts.
- Utilização de TypeScript para tipagem estática.
- Tailwind CSS para uma abordagem utility-first na estilização.
- Alias de importação `@/*` para `src/`.
- Imagens estáticas servidas a partir de `src/assets/`.

## 3. Padrões de Design em Uso

- **Component-Based Architecture:** Divisão da UI em componentes menores e gerenciáveis.
- **Utility-First CSS:** Com Tailwind CSS.
- **Single Page Application (SPA):** Com Next.js.
- **Layout Responsivo (futuramente):** Embora o foco inicial seja desktop, o Tailwind facilita a responsividade.

## 4. Relacionamento entre Componentes (Página de Chat)

- `src/app/page.tsx` atuará como a página principal, orquestrando a `Navbar` e os painéis `AnimePanel` e `ChatPanel`.
- A `Navbar` será um componente independente.
- `AnimePanel` e `ChatPanel` serão componentes irmãos dispostos lado a lado abaixo da `Navbar`.

## 5. Caminhos Críticos de Implementação

- Layout correto dos três principais componentes da UI (Navbar, AnimePanel, ChatPanel).
- Estilização coesa para alcançar o tema "extremamente fofo" e de anime.
- Integração da imagem da personagem no `AnimePanel`.
- Estrutura básica do `ChatPanel` (área de mensagens, campo de input). 