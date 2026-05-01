# XiaoLee Design System & Guidelines

Atualizado em: **2026-04-30** — Revisão v2 (UI Premium Refactor)

Este documento detalha a linguagem visual, padrões e especificações técnicas para a interface premium do XiaoLee, focada em transmitir uma estética moderna, limpa e sofisticada, alinhada aos melhores projetos DeFi do ecossistema Solana.

---

## 1. Princípios de Design

1. **Elegância Limpa (Clean Elegance):** Menos ruído visual, mais respiro (whitespace). Remoção de gradientes pesados e bordas multicoloridas em favor de tons pastéis sutis e cards uniformes.
2. **Tipografia Premium:** Uso da fonte **Inter** (sans-serif) para legibilidade, seriedade e modernidade.
3. **Ícones Vetoriais SVG Inline:** Emojis de UI foram substituídos por SVGs inline customizados (stroke-based, `strokeWidth={1.8}`), garantindo consistência visual cross-platform sem dependência de biblioteca externa.
4. **Paleta Unificada:** Todas as páginas compartilham a mesma base pink/fuchsia/purple, evitando que cada seção pareça um produto diferente.
5. **Hierarquia Natural:** Títulos concisos, subtítulos em `text-gray-400`, valores em negrito — sem `animate-pulse` em textos, sem gradientes clip-text desnecessários.
6. **Responsividade Tátil (Mobile-First):** `max-w-2xl mx-auto` como container padrão para mobile, `100dvh` para evitar sobreposição de teclado virtual.

---

## 2. Tipografia

A família tipográfica principal do projeto é a **Inter**.

- **Font-family:** `'Inter', system-ui, -apple-system, sans-serif`
- **Pesos (Weights):**
  - Regular (400): Corpo de texto e descrições.
  - Medium (500): Subtítulos de seções, labels de UI.
  - Semi-Bold (600): Itens de navegação, botões secundários.
  - Bold (700) / Black (900): Títulos principais (H1), valores numéricos (saldos, contadores).

**Ajustes de implementação:** A fonte é carregada via `next/font/google` no arquivo `layout.tsx`.

---

## 3. Paleta de Cores

A paleta principal é baseada em **Pink / Fuchsia / Purple** (estética kawaii premium), com acentos semânticos para estados.

### 3.1. Background Global

```css
background: linear-gradient(to bottom right, #fdf2f8 /* pink-50 */, #faf5ff /* purple-50 */, #fdf4ff /* fuchsia-100 */);
```

Classe Tailwind: `bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100`

### 3.2. Cards / Painéis

| Elemento | Classes Tailwind | Uso |
|---|---|---|
| Card padrão | `bg-white/70 backdrop-blur-md border border-pink-100 rounded-2xl shadow-sm` | Todos os cards de conteúdo |
| Card stat | `bg-{color}-50 border border-{color}-100 rounded-2xl` | Stats coloridas (pink, violet, emerald, amber) |
| Input/monospace | `bg-gray-50 border border-gray-100 rounded-xl` | Endereços, hashes, código |

### 3.3. Textos

| Papel | Classe | Hex aproximado |
|---|---|---|
| Título principal | `bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent` | — |
| Subtítulo / desc | `text-gray-400` | `#9ca3af` |
| Corpo de texto | `text-gray-600` | `#4b5563` |
| Label seção | `text-gray-500 uppercase tracking-widest text-xs font-bold` | — |
| Valor de destaque | `text-gray-800 font-black` | `#1f2937` |

### 3.4. Cores Semânticas

| Estado | Cor principal | Uso |
|---|---|---|
| Acento Brand | `text-fuchsia-500` / `text-fuchsia-400` | Ícones, links ativos, badges |
| Sucesso / Entregue | `text-emerald-500`, `bg-emerald-50`, `border-emerald-100` | Status "delivered", botão ACK |
| Pendente | `text-amber-500`, `bg-amber-50`, `border-amber-100` | Status "pending" |
| Erro / Alerta | `text-red-600`, `bg-red-50`, `border-red-200` | Erros de API |
| Info / Warning | `text-orange-600`, `bg-orange-50`, `border-orange-100` | Avisos não críticos |

---

## 4. Iconografia

### Regra Principal: SVG Inline, sem emojis de UI

Emojis de UI (🔒, 👥, 🎁, 🔥, ✅, etc.) foram removidos de todos os componentes de layout, substituídos por SVGs inline `stroke-based` com as seguintes especificações:

```tsx
// Padrão de ícone SVG inline
const IconExample = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"  // ou w-5 h-5 conforme contexto
  >
    {/* paths */}
  </svg>
);
```

**Por que inline e não biblioteca?** Evita bundle overhead, permite treeshaking natural do Next.js, e garante que a cor herde de `currentColor` (controlável via classes Tailwind como `text-fuchsia-400`).

### Tamanhos Padrão

| Contexto | Classe |
|---|---|
| Ícone em label/header de seção | `w-4 h-4` |
| Ícone em card de stat pequeno | `w-4 h-4` |
| Ícone em card de stat grande (Economia Global) | `w-5 h-5` |
| Ícone de estado vazio (empty state) | `w-6 h-6` |
| Ícone de estado desconectado | `w-5 h-5` |

### Mapeamento de Ícones por Contexto

| Contexto | Ícone |
|---|---|
| Campanhas / Target | Circle + inner circles (target) |
| Verificadas / Check | Polyline `20 6 9 17 4 12` |
| Premiadas / Award | Circle + ribbon path |
| $XLEE Token | Circle com `+` interno |
| Wallet desconectada | Wallet outline |
| Swaps / Bar chart | `IconBarChart` (3 linhas verticais) |
| Total Value Locked | Lock / cadeado |
| Active Users | Users (dois avatares) |
| Rewards | Gift box |
| Campaigns Created | `TrendingUp` |
| Atividade Recente | Polyline tipo ECG |
| Arquitetura / CPU | `IconCpu` (retângulo com linhas) |
| Wallet-first (arch) | Shield |
| Jupiter (arch) | Zap/relâmpago |
| Helius (arch) | Wifi signal |
| Reward (feed) | Trophy |
| Swap (feed) | Refresh circular |
| Campaign (feed) | Target |
| Info (feed) | Bell |
| Empty state (feed) | Inbox |

> **Exceção permitida:** Emojis reativos nas mensagens de chat da Xiaolee (💕, 👏, 😊) e os decorativos do Avatar são mantidos — são parte da personalidade da IA, não da UI de layout.

---

## 5. Estrutura de Layout

### Container Principal

```tsx
<main className="container mx-auto px-4 py-10 max-w-2xl">
```

O `max-w-2xl` (672px) garante que o layout seja consistente mobile-first, com padding lateral de `px-4`.

### Cards

Todos os cards seguem o mesmo padrão base, com variações de cor apenas nas bordas/backgrounds semânticos:

```tsx
// Card padrão
<div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm p-5">

// Card de stat colorido
<div className="rounded-2xl border border-{color}-100 bg-{color}-50 p-4 text-center">
```

**Proibido:** bordas gradiente (`bg-gradient-to-r ... p-[2px]`) nos cards de conteúdo — cria inconsistência visual e "caráter de IA".

### Espaçamento entre Seções

```tsx
// Espaçamento vertical entre blocos
<div className="mb-6"> // entre seções
<div className="space-y-3"> // entre rows dentro de um card
<div className="gap-3"> // entre cards em grid
```

---

## 6. Navbar

A Navbar utiliza ícones SVG inline para Camp, Alerts e Dash, com gradientes distintos por aba:

| Aba | Gradiente | Motivo |
|---|---|---|
| Camp | `from-pink-400 via-fuchsia-500 to-purple-500` | Identidade principal brand |
| Alerts | `from-cyan-400 to-blue-500` | Diferenciação visual — notificações |
| Dash | `from-violet-500 to-indigo-600` | Dashboard / analytics |

A diferença de cor no botão Alerts é intencional: cria distinção imediata para o usuário localizar notificações rapidamente sem ler o texto.

---

## 7. Página de Notificações

**Padrão adotado:** layout single-column `max-w-2xl`, sem grid de 2 colunas.

### Estrutura da página:

1. **Header** — Ícone box gradiente + título "Notification Center" + desc curta
2. **Stats row** — Grid 3 colunas (Total / Entregues / Pendentes) com cores semânticas
3. **Devnet Context** — Card compacto com session/wallet truncados (`truncate`)
4. **Lista de notificações** — Card container com header (título + botão Refresh) e lista com `divide-y`

### Item de notificação:

```
[dot status] [título + badge] [botão ação]
             [body text]
             [receipt block] (se existir)
             [metadata] (se existir)
```

---

## 8. Dashboard

**Padrão adotado:** layout single-column `max-w-2xl`, sem sidebar.

### Estrutura da página:

1. **Header** — Título "Dashboard" + desc curta (sem emoji, sem pulse)
2. **Campaign Stats** — Grid 3 colunas (Campanhas / Verificadas / Premiadas) com SVG icons
3. **Tokenomics Card** — Rows key/value com separadores `border-b border-gray-100/80`
4. **User Stats Card** — Estado desconectado limpo (SVG wallet icon) / grid 2 colunas quando conectado
5. **Economia Global** — Grid 2x2 com `EconomyStat` (icon box + valor + label)
6. **Atividade Recente** — ActivityFeed com SVG icons por tipo de evento
7. **Arquitetura Descentralizada** — Grid 2x2 de tech badges com SVG icons

---

## 9. Referências Web3 / DeFi

Este design system busca inspiração em interfaces reconhecidas por sua excelência visual no ecossistema cripto:
- **Phantom Wallet:** Limpeza, botões arredondados, tons de roxo/azul.
- **Jupiter Exchange:** Foco na área principal de ação, modais clean com glassmorphism.
- **Backpack:** Tipografia forte (Inter/sans), alto contraste entre fundo e painéis.
