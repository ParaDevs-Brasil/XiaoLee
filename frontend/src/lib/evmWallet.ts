"use client";

/**
 * Minimal EIP-1193 injected-wallet helpers (MetaMask, Rabby, Coinbase, …).
 * No SDK dependency — the payment rail itself lives in the backend
 * (Circle W3S / arc_native); the frontend only needs the user's address.
 */

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

const STORAGE_KEY = "xiaolee_evm_address";

// Friendly names for the chains XiaoLee touches (CCTP path: Sepolia ↔ Arc)
const CHAIN_NAMES: Record<string, string> = {
  "0x1": "Ethereum",
  "0xaa36a7": "Ethereum Sepolia",
  "0x66eee": "Arbitrum Sepolia",
  "0x14a34": "Base Sepolia",
  "0x2105": "Base",
  "0xa4b1": "Arbitrum One",
};

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

export function isEvmWalletInstalled(): boolean {
  return getInjectedProvider() !== null;
}

export async function connectEvmWallet(): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error("no_wallet");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("no_account");
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, address);
  }
  return address;
}

export async function getEvmChainName(): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) return "";
  try {
    const chainId = (await provider.request({ method: "eth_chainId" })) as string;
    return CHAIN_NAMES[chainId?.toLowerCase()] ?? `Chain ${parseInt(chainId, 16)}`;
  } catch {
    return "";
  }
}

export function getStoredEvmAddress(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function clearStoredEvmAddress(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function shortEvmAddress(address: string, front = 6, back = 4): string {
  if (!address || address.length <= front + back + 2) return address;
  return `${address.slice(0, front)}…${address.slice(-back)}`;
}
