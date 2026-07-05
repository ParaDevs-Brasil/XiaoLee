"use client";

/**
 * Detecção e conexão multi-wallet — um conector por trilho de payout:
 *
 *   arc (EVM)  — EIP-6963 (MetaMask, Rabby, Coinbase, …) + fallback window.ethereum
 *   solana     — Phantom / Solflare (provider injetado)
 *   stellar    — Freighter (via @stellar/freighter-api, já usado no projeto)
 *
 * Cada wallet detectada expõe `connect()` que devolve o endereço nativo; a
 * chain do endereço bate com `detectChainFromAddress` (lib/chains.ts).
 */

import type { Chain } from "./chains";
import type { Eip1193Provider } from "./evmWallet";

export interface DetectedWallet {
  id: string;
  name: string;
  chain: Chain;
  icon?: string;
  connect: () => Promise<string>;
}

const EVM_STORAGE_KEY = "xiaolee_evm_address";

// ── EVM · EIP-6963 multi-provider discovery ────────────────────────────────

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

async function connectEvmProvider(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("no_account");
  window.localStorage.setItem(EVM_STORAGE_KEY, address);
  return address;
}

function discoverEip6963(timeoutMs = 200): Promise<Eip6963ProviderDetail[]> {
  return new Promise((resolve) => {
    const found = new Map<string, Eip6963ProviderDetail>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (detail?.info?.rdns) found.set(detail.info.rdns, detail);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve([...found.values()]);
    }, timeoutMs);
  });
}

// Algumas extensões anunciam o ícone EIP-6963 com whitespace/caractere de
// controle no início — o <Image> do Next rejeita o data URI. Só repassa URIs limpos.
function sanitizeIcon(icon: string | undefined): string | undefined {
  const trimmed = icon?.trim();
  if (!trimmed) return undefined;
  return /^(data:image\/|https:\/\/)/.test(trimmed) ? trimmed : undefined;
}

async function detectEvmWallets(): Promise<DetectedWallet[]> {
  const announced = await discoverEip6963();
  if (announced.length > 0) {
    return announced.map(({ info, provider }) => ({
      id: info.rdns,
      name: info.name,
      chain: "arc" as const,
      icon: sanitizeIcon(info.icon),
      connect: () => connectEvmProvider(provider),
    }));
  }
  // Fallback legado: provider único injetado em window.ethereum
  const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!eth) return [];
  return [
    {
      id: "injected-evm",
      name: eth.isMetaMask ? "MetaMask" : "Carteira EVM",
      chain: "arc",
      connect: () => connectEvmProvider(eth),
    },
  ];
}

// ── Solana · Phantom / Solflare ────────────────────────────────────────────

interface SolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
}

function detectSolanaWallets(): DetectedWallet[] {
  const w = window as Window & {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider & { isSolflare?: boolean };
  };
  const wallets: DetectedWallet[] = [];

  const phantom = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined);
  if (phantom) {
    wallets.push({
      id: "phantom",
      name: "Phantom",
      chain: "solana",
      connect: async () => (await phantom.connect()).publicKey.toString(),
    });
  }
  if (w.solflare?.isSolflare) {
    const solflare = w.solflare;
    wallets.push({
      id: "solflare",
      name: "Solflare",
      chain: "solana",
      connect: async () => (await solflare.connect()).publicKey.toString(),
    });
  }
  return wallets;
}

// ── Stellar · Freighter ────────────────────────────────────────────────────

async function detectStellarWallets(): Promise<DetectedWallet[]> {
  const { isFreighterInstalled, connectFreighter } = await import("@/utils/stellar");
  if (!(await isFreighterInstalled())) return [];
  return [
    {
      id: "freighter",
      name: "Freighter",
      chain: "stellar",
      connect: connectFreighter,
    },
  ];
}

// ── API pública ────────────────────────────────────────────────────────────

/** Lista todas as wallets instaladas no browser, agrupáveis por chain. */
export async function detectWallets(): Promise<DetectedWallet[]> {
  if (typeof window === "undefined") return [];
  const [evm, stellar] = await Promise.all([detectEvmWallets(), detectStellarWallets()]);
  return [...evm, ...detectSolanaWallets(), ...stellar];
}

// ── Wallet conectada (qualquer chain) — persistência da sessão ─────────────

const CONNECTED_KEY = "xiaolee_wallet";

export interface ConnectedWallet {
  address: string;
  chain: Chain;
  walletName: string;
  /** rdns EIP-6963 do provider usado na conexão (ex: io.rabby) — assinar sempre pelo mesmo */
  providerId?: string;
}

export function storeConnectedWallet(wallet: ConnectedWallet): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONNECTED_KEY, JSON.stringify(wallet));
}

export function getStoredConnectedWallet(): ConnectedWallet | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONNECTED_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConnectedWallet;
    return parsed.address ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStoredConnectedWallet(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONNECTED_KEY);
  window.localStorage.removeItem(EVM_STORAGE_KEY);
}

/**
 * Resolve o provider EVM certo para ASSINAR: com múltiplas extensões instaladas
 * (Rabby/MetaMask/Phantom/Backpack), window.ethereum é de quem venceu a disputa —
 * não necessariamente a wallet que o usuário conectou. Ordem: rdns salvo na conexão
 * → provider anunciado cujo eth_accounts contém o endereço → window.ethereum.
 */
export async function resolveEvmProvider(address?: string): Promise<Eip1193Provider | null> {
  if (typeof window === "undefined") return null;
  const announced = await discoverEip6963();
  const storedId = getStoredConnectedWallet()?.providerId;

  if (storedId) {
    const match = announced.find((d) => d.info.rdns === storedId);
    if (match) return match.provider;
  }

  if (address) {
    for (const { provider } of announced) {
      try {
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        if (accounts?.some((a) => a.toLowerCase() === address.toLowerCase())) return provider;
      } catch {
        // provider indisponível — tenta o próximo
      }
    }
  }

  const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return announced[0]?.provider ?? eth ?? null;
}
