import React, { useState, useCallback } from "react";
import { WalletProps } from "@/interfaces";
import { formatCurrency } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";
import { Connection, PublicKey, clusterApiUrl, VersionedTransaction } from "@solana/web3.js";
import {
  getQuoteSummary,
  SWAP_TOKEN_OPTIONS,
  toRawAmount,
} from "@/utils/swap";

const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:8000";

// All tokens XiaoLee supports on Solana devnet
const XIAOLEE_TOKENS = [
  {
    symbol: "SOL",
    name: "Solana",
    network: "Solana Devnet",
    mint: "native",
    decimals: 9,
    icon: "◎",
    color: "from-purple-400 to-pink-400",
  },
  ...SWAP_TOKEN_OPTIONS.filter((t) => t.mint !== "So11111111111111111111111111111111111111112").map((t) => ({
    symbol: t.symbol,
    name: t.symbol,
    network: "Solana Devnet",
    mint: t.mint,
    decimals: t.decimals,
    icon: t.symbol === "USDC" ? "$" : "🪙",
    color: "from-blue-400 to-cyan-400",
  })),
];

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (opts?: object) => Promise<{ publicKey: { toString: () => string } }>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

type SwapPrepareResponse = {
  cluster: string;
  quote: unknown;
  swap_transaction_base64: string;
  last_valid_block_height?: number;
  disclaimer: string;
};

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { solana?: PhantomProvider }).solana;
  if (!candidate || !candidate.isPhantom) return null;
  return candidate;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function truncateAddress(addr: string) {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

const Wallet: React.FC<WalletProps> = ({ balance = [], shouldOpen = false, onClose }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [swapAmount, setSwapAmount] = useState<string>("1");
  const [inputMint, setInputMint] = useState<string>(SWAP_TOKEN_OPTIONS[0].mint);
  const [outputMint, setOutputMint] = useState<string>(SWAP_TOKEN_OPTIONS[1].mint);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [preparedSwap, setPreparedSwap] = useState<SwapPrepareResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string>("");
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [txSignature, setTxSignature] = useState<string>("");
  const [userConfirmedSend, setUserConfirmedSend] = useState(false);
  const [flowMessage, setFlowMessage] = useState<string>("");
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [splBalances, setSplBalances] = useState<Record<string, number>>({});
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const fetchAllBalances = useCallback(async (address: string) => {
    if (!address) return;
    setIsFetchingBalance(true);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const pubkey = new PublicKey(address);

      // SOL native balance
      const lamports = await conn.getBalance(pubkey);
      setSolBalance(lamports / 1_000_000_000);

      // SPL token balances
      const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      });

      const balanceMap: Record<string, number> = {};
      for (const { account } of tokenAccounts.value) {
        const info = account.data.parsed?.info;
        if (!info) continue;
        const mint = info.mint as string;
        const amount = parseFloat(info.tokenAmount?.uiAmountString ?? "0");
        balanceMap[mint] = amount;
      }
      setSplBalances(balanceMap);
    } catch {
      setSolBalance(null);
    } finally {
      setIsFetchingBalance(false);
    }
  }, []);

  const autoConnectPhantom = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) return;
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      localStorage.setItem("connected_wallet", addr);
      await fetchAllBalances(addr);
    } catch {
      const saved = localStorage.getItem("connected_wallet");
      if (saved) {
        setWalletAddress(saved);
        await fetchAllBalances(saved);
      }
    }
  }, [fetchAllBalances]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedWallet = localStorage.getItem("connected_wallet");
      if (savedWallet) {
        setWalletAddress(savedWallet);
        fetchAllBalances(savedWallet);
      }
    }
  }, [fetchAllBalances]);

  React.useEffect(() => {
    if (isOpen) autoConnectPhantom();
  }, [isOpen, autoConnectPhantom]);

  const getMyBalance = () =>
    Array.isArray(balance) ? balance.reduce((t, tok) => t + (tok.valueUSD || 0), 0) : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (walletAddress) await fetchAllBalances(walletAddress);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectWallet = async () => {
    const provider = getPhantomProvider();
    if (!provider) {
      setFlowMessage("Phantom Wallet nao encontrada. Instale a extensao para continuar.");
      return;
    }
    try {
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      localStorage.setItem("connected_wallet", addr);
      setFlowMessage("Carteira conectada na Solana Devnet.");
      fetchAllBalances(addr);
    } catch {
      setFlowMessage("Nao foi possivel conectar a carteira.");
    }
  };

  const handleCopyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getTokenBalance = (token: typeof XIAOLEE_TOKENS[0]): number => {
    if (token.mint === "native") return solBalance ?? 0;
    return splBalances[token.mint] ?? 0;
  };

  const totalSolValue = solBalance ?? 0;

  const handlePrepareAndSimulate = async () => {
    if (!walletAddress) {
      setFlowMessage("Conecte a carteira antes de preparar o swap.");
      return;
    }
    const inputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === inputMint);
    const outputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === outputMint);
    if (!inputToken || !outputToken) {
      setFlowMessage("Selecione tokens validos para o swap.");
      return;
    }
    if (inputToken.mint === outputToken.mint) {
      setFlowMessage("Token de entrada e saida nao podem ser iguais.");
      return;
    }
    const parsedAmount = Number(swapAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFlowMessage("Informe um valor valido para o token de entrada.");
      return;
    }
    setIsPreparing(true);
    setPreparedSwap(null);
    setSimulationError("");
    setSimulationLogs([]);
    setTxSignature("");
    setUserConfirmedSend(false);
    try {
      const amountRaw = toRawAmount(parsedAmount, inputToken.decimals);
      const response = await fetch(`${CORE_API_URL}/v1/solana/swap/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_public_key: walletAddress,
          input_mint: inputToken.mint,
          output_mint: outputToken.mint,
          amount_raw: amountRaw,
          slippage_bps: 50,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Falha ao preparar swap.");
      }
      const payload: SwapPrepareResponse = await response.json();
      setPreparedSwap(payload);
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const txBytes = base64ToBytes(payload.swap_transaction_base64);
      const tx = VersionedTransaction.deserialize(txBytes);
      const simulation = await conn.simulateTransaction(tx, { sigVerify: false });
      if (simulation.value.err) setSimulationError(JSON.stringify(simulation.value.err));
      setSimulationLogs(simulation.value.logs || []);
      setFlowMessage("Swap preparado e simulado. Revise antes de assinar.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro inesperado ao preparar swap.";
      setFlowMessage(msg);
    } finally {
      setIsPreparing(false);
    }
  };

  const inputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === inputMint) || SWAP_TOKEN_OPTIONS[0];
  const outputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === outputMint) || SWAP_TOKEN_OPTIONS[1];
  const quoteSummary = preparedSwap
    ? getQuoteSummary(preparedSwap.quote, outputToken.decimals)
    : { outAmountUi: 0, priceImpactPct: 0, minOutAmountUi: 0, routeHops: 0, slippageBps: 0 };

  const handleSignAndSend = async () => {
    if (!preparedSwap?.swap_transaction_base64) {
      setFlowMessage("Prepare o swap antes de assinar.");
      return;
    }
    if (!userConfirmedSend) {
      setFlowMessage("Confirme que revisou a simulacao antes de enviar.");
      return;
    }
    const provider = getPhantomProvider();
    if (!provider) {
      setFlowMessage("Phantom Wallet nao encontrada.");
      return;
    }
    setIsSending(true);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const txBytes = base64ToBytes(preparedSwap.swap_transaction_base64);
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await provider.signTransaction(tx);
      const signature = await conn.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await conn.confirmTransaction(signature, "confirmed");
      setTxSignature(signature);
      setFlowMessage("Transacao enviada com sucesso na Devnet.");
      await fetchAllBalances(walletAddress);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao assinar/enviar transacao.";
      setFlowMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-5xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
              animateIn ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-[var(--modal-footer-border)]">
              <div className="px-6 pt-6 flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                    💰 My Wallet
                  </h2>
                  <p className="text-[var(--modal-header-subtitle)]">Your crypto balance</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isFetchingBalance}
                    aria-label="Atualizar saldos"
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg
                      className={`w-5 h-5 text-blue-400 ${isRefreshing || isFetchingBalance ? "animate-spin" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      setWalletAddress("");
                      setSolBalance(null);
                      setSplBalances({});
                      localStorage.removeItem("connected_wallet");
                      setFlowMessage("Carteira desconectada.");
                    }}
                    aria-label="Desconectar carteira"
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>

                  <button
                    onClick={closeModal}
                    aria-label="Fechar carteira"
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Integrated tokens strip — edge to edge */}
              <div className="w-full overflow-x-auto">
                <div className="flex items-stretch min-w-full divide-x divide-purple-100/60">
                  {/* Solana group */}
                  {[
                    { symbol: "SOL",  name: "Solana",       network: "Solana",  icon: "◎", bg: "from-purple-500 to-violet-500" },
                    { symbol: "USDC", name: "USD Coin",     network: "Solana",  icon: "$",  bg: "from-blue-500 to-cyan-500" },
                  ].map((t) => (
                    <div key={`sol-${t.symbol}`} className="flex-1 flex items-center gap-2 px-4 py-2 bg-purple-50/40 hover:bg-purple-100/40 transition-colors min-w-[100px]">
                      <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${t.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {t.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--token-card-title)] leading-none">{t.symbol}</p>
                        <p className="text-[10px] text-purple-400 leading-none mt-0.5">{t.network}</p>
                      </div>
                    </div>
                  ))}

                  {/* Divider label */}
                  <div className="flex items-center px-3 bg-gradient-to-b from-purple-50/20 to-pink-50/20 shrink-0">
                    <span className="text-[10px] font-semibold text-purple-300 tracking-widest rotate-0 whitespace-nowrap">✦</span>
                  </div>

                  {/* Stellar group */}
                  {[
                    { symbol: "XLM",  name: "Stellar Lumens", network: "Stellar", icon: "★", bg: "from-sky-400 to-blue-500" },
                    { symbol: "USDC", name: "USD Coin",        network: "Stellar", icon: "$",  bg: "from-indigo-400 to-violet-400" },
                  ].map((t) => (
                    <div key={`xlm-${t.symbol}`} className="flex-1 flex items-center gap-2 px-4 py-2 bg-sky-50/40 hover:bg-sky-100/40 transition-colors min-w-[100px]">
                      <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${t.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {t.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--token-card-title)] leading-none">{t.symbol}</p>
                        <p className="text-[10px] text-sky-400 leading-none mt-0.5">{t.network}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Balance */}
              <div className="mx-6 my-4 text-center bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-6">
                <p className="text-sm text-[var(--modal-header-subtitle)] mb-2">Total Balance</p>
                {solBalance !== null ? (
                  <>
                    <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                      {totalSolValue.toFixed(4)} SOL
                    </p>
                    <p className="text-xs text-[var(--modal-header-subtitle)] mt-1">Solana Devnet</p>
                  </>
                ) : (
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                    {formatCurrency(getMyBalance())}
                  </p>
                )}
              </div>
            </div>

            {/* Token List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-[var(--modal-section-title)] mb-4 flex items-center gap-2">
                  💎 Your Tokens
                  <span className="text-xs font-normal text-[var(--modal-header-subtitle)] ml-1">
                    — clique em um token para ver detalhes
                  </span>
                </h3>

                <div className="space-y-2">
                  {XIAOLEE_TOKENS.map((token) => {
                    const bal = getTokenBalance(token);
                    const isExpanded = expandedToken === token.mint;

                    return (
                      <div key={token.mint}>
                        {/* Token row — clickable */}
                        <button
                          type="button"
                          onClick={() => setExpandedToken(isExpanded ? null : token.mint)}
                          className={`w-full bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border transition-all duration-200 text-left ${
                            isExpanded
                              ? "border-purple-400 rounded-b-none"
                              : "border-[var(--token-card-border)] hover:border-[var(--token-card-border-hover)]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 bg-gradient-to-r ${token.color} rounded-lg flex items-center justify-center text-lg font-bold text-white`}>
                                {token.icon}
                              </div>
                              <div>
                                <h4 className="font-semibold text-[var(--token-card-title)]">{token.symbol}</h4>
                                <p className="text-xs text-[var(--token-balance-label)]">{token.network}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                {isFetchingBalance ? (
                                  <span className="text-xs text-[var(--modal-header-subtitle)] animate-pulse">carregando...</span>
                                ) : (
                                  <p className="font-semibold text-[var(--token-value-amount)]">
                                    {bal > 0 ? bal.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0"}{" "}
                                    {token.symbol}
                                  </p>
                                )}
                              </div>
                              <svg
                                className={`w-4 h-4 text-[var(--modal-header-subtitle)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div className="border border-t-0 border-purple-400 rounded-b-xl bg-white/40 dark:bg-white/5 px-4 py-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[var(--modal-header-subtitle)]">Endereço da wallet</span>
                              <div className="flex items-center gap-2">
                                <code className="font-mono text-xs bg-black/5 dark:bg-white/10 px-2 py-1 rounded">
                                  {walletAddress ? truncateAddress(walletAddress) : "—"}
                                </code>
                                {walletAddress && (
                                  <button
                                    onClick={handleCopyAddress}
                                    className="text-xs text-purple-500 hover:text-purple-700 transition-colors"
                                    title="Copiar endereço"
                                  >
                                    {copied ? "✓ copiado" : "copiar"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-[var(--modal-header-subtitle)]">
                              <span>Rede</span>
                              <span className="font-medium">{token.network}</span>
                            </div>
                            <div className="flex justify-between text-xs text-[var(--modal-header-subtitle)]">
                              <span>Saldo</span>
                              <span className="font-medium">
                                {bal.toLocaleString(undefined, { maximumFractionDigits: 9 })} {token.symbol}
                              </span>
                            </div>
                            {token.mint !== "native" && (
                              <div className="flex justify-between text-xs text-[var(--modal-header-subtitle)]">
                                <span>Mint</span>
                                <code className="font-mono text-xs">{truncateAddress(token.mint)}</code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* DB tokens (campaign rewards etc.) */}
                  {Array.isArray(balance) && balance.map((tokenData) => (
                    <div
                      key={tokenData.token}
                      className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-[var(--token-icon-bg-start)] to-[var(--token-icon-bg-end)] rounded-lg flex items-center justify-center text-lg">
                            💰
                          </div>
                          <div>
                            <h4 className="font-semibold text-[var(--token-card-title)]">{tokenData.token}</h4>
                            <p className="text-sm text-[var(--token-balance-label)]">
                              {tokenData.balance.toLocaleString()} tokens
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-[var(--token-value-amount)]">
                            ${tokenData.valueUSD.toFixed(2)}
                          </p>
                          <p className="text-sm text-[var(--token-info-label)]">
                            ${tokenData.priceUSD.toFixed(4)} each
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!walletAddress && (!balance || balance.length === 0) && (
                    <div className="text-center py-10">
                      <div className="text-5xl mb-3">🐣</div>
                      <p className="text-[var(--modal-header-subtitle)] text-sm">
                        Conecte a Phantom Wallet para ver seus tokens
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer — Swap */}
            <div className="p-6 border-t border-[var(--modal-footer-border)]">
              <h3 className="text-lg font-semibold text-[var(--modal-section-title)] mb-3">
                Swap Solana Devnet
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <button
                  onClick={handleConnectWallet}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                >
                  {walletAddress ? "Carteira conectada" : "Conectar Phantom"}
                </button>

                <input
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[var(--token-card-border)] bg-white/70"
                  placeholder={`Quantidade ${inputToken.symbol}`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <label className="text-sm text-[var(--token-info-label)]">
                  Token de entrada
                  <select
                    value={inputMint}
                    onChange={(e) => setInputMint(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--token-card-border)] bg-white/70"
                  >
                    {SWAP_TOKEN_OPTIONS.map((token) => (
                      <option key={token.mint} value={token.mint}>{token.symbol}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-[var(--token-info-label)]">
                  Token de saida
                  <select
                    value={outputMint}
                    onChange={(e) => setOutputMint(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--token-card-border)] bg-white/70"
                  >
                    {SWAP_TOKEN_OPTIONS.map((token) => (
                      <option key={token.mint} value={token.mint}>{token.symbol}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col md:flex-row gap-3 mb-3">
                <button
                  onClick={handlePrepareAndSimulate}
                  disabled={isPreparing || !walletAddress}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                >
                  {isPreparing ? "Preparando..." : "Preparar e Simular"}
                </button>

                <button
                  onClick={handleSignAndSend}
                  disabled={isSending || !preparedSwap || Boolean(simulationError) || !userConfirmedSend}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                >
                  {isSending ? "Enviando..." : "Assinar e Enviar"}
                </button>
              </div>

              {preparedSwap && (
                <label className="flex items-center gap-2 mb-3 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userConfirmedSend}
                    onChange={(e) => setUserConfirmedSend(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  Confirmo que revisei a simulacao e quero enviar na Devnet.
                </label>
              )}

              {preparedSwap && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Resumo de execucao</p>
                  <p className="text-xs text-amber-700">Rota: {inputToken.symbol} → {outputToken.symbol}</p>
                  <p className="text-xs text-amber-700">Entrada: {swapAmount || "0"} {inputToken.symbol}</p>
                  <p className="text-xs text-amber-700">Saida estimada: {quoteSummary.outAmountUi.toFixed(6)} {outputToken.symbol}</p>
                  <p className="text-xs text-amber-700">Minimo garantido: {quoteSummary.minOutAmountUi.toFixed(6)} {outputToken.symbol}</p>
                  <p className="text-xs text-amber-700">Price impact: {(quoteSummary.priceImpactPct * 100).toFixed(4)}% | Slippage: {(quoteSummary.slippageBps / 100).toFixed(2)}%</p>
                  <p className="text-xs text-amber-700">Cluster: {preparedSwap.cluster}</p>
                </div>
              )}

              {simulationError && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  Erro na simulacao: {simulationError}
                </div>
              )}

              {simulationLogs.length > 0 && (
                <details className="mb-3">
                  <summary className="text-sm font-semibold cursor-pointer text-slate-600 mb-1">
                    Logs da simulacao ({simulationLogs.length})
                  </summary>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 max-h-28 overflow-auto text-xs text-slate-700 space-y-1 mt-1">
                    {simulationLogs.map((line, idx) => (
                      <p key={`${idx}-${line}`}>{line}</p>
                    ))}
                  </div>
                </details>
              )}

              {txSignature && (
                <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm break-all">
                  Tx Signature: {txSignature}
                </div>
              )}

              {flowMessage && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                  {flowMessage}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--modal-footer-border)] bg-gradient-to-r from-[var(--modal-footer-bg-start)] to-[var(--modal-footer-bg-end)]">
              <div className="text-center text-sm text-[var(--modal-footer-text)]">
                Secured by Xiaolee 🌸
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Wallet;
