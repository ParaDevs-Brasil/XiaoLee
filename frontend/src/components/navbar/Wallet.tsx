import React, { useState } from "react";
import { WalletProps } from "@/interfaces";
import { formatCurrency } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";
import { Connection, PublicKey, clusterApiUrl, VersionedTransaction } from "@solana/web3.js";
import { getQuoteSummary, SWAP_TOKEN_OPTIONS, toRawAmount } from "@/utils/swap";
import { useLanguage } from "@/contexts/LanguageContext";

const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────────
type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};
type SwapPrepareResponse = {
  cluster: string;
  quote: unknown;
  swap_transaction_base64: string;
  last_valid_block_height?: number;
  disclaimer: string;
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconWallet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);
const IconRefresh = ({ spinning }: { spinning?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}>
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconDisconnect = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSwap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const c = (window as Window & { solana?: PhantomProvider }).solana;
  return c?.isPhantom ? c : null;
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── Component ──────────────────────────────────────────────────────────────────
const Wallet: React.FC<WalletProps> = ({ balance = [], shouldOpen = false, onClose }) => {
  const { t } = useLanguage();
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
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const fetchSolBalance = async (address: string) => {
    if (!address) return;
    setIsFetchingBalance(true);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const lamports = await conn.getBalance(new PublicKey(address));
      setSolBalance(lamports / 1_000_000_000);
    } catch { setSolBalance(null); }
    finally { setIsFetchingBalance(false); }
  };

React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("connected_wallet");
      if (saved) { setWalletAddress(saved); fetchSolBalance(saved); }
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const provider = getPhantomProvider();
    if (!provider) return;
    (async () => {
      try {
        const resp = await (provider as PhantomProvider & { connect(opts: { onlyIfTrusted: boolean }): Promise<{ publicKey: { toString(): string } }> }).connect({ onlyIfTrusted: true });
        const addr = resp.publicKey.toString();
        setWalletAddress(addr);
        localStorage.setItem("connected_wallet", addr);
        await fetchSolBalance(addr);
      } catch {
        const saved = localStorage.getItem("connected_wallet");
        if (saved) { setWalletAddress(saved); fetchSolBalance(saved); }
      }
    })();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const getMyBalance = () =>
    Array.isArray(balance) ? balance.reduce((t, tok) => t + (tok.valueUSD || 0), 0) : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { if (walletAddress) await fetchSolBalance(walletAddress); }
    finally { setIsRefreshing(false); }
  };

  const handleConnectWallet = async () => {
    const provider = getPhantomProvider();
    if (!provider) { setFlowMessage(t('wallet.phantom_not_found')); return; }
    try {
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      localStorage.setItem("connected_wallet", addr);
      setFlowMessage(t('wallet.connected_msg'));
      fetchSolBalance(addr);
    } catch { setFlowMessage(t('wallet.connect_error')); }
  };

  const handlePrepareAndSimulate = async () => {
    if (!walletAddress) { setFlowMessage(t('wallet.connect_first')); return; }
    const inputToken = SWAP_TOKEN_OPTIONS.find((tok) => tok.mint === inputMint);
    const outputToken = SWAP_TOKEN_OPTIONS.find((tok) => tok.mint === outputMint);
    if (!inputToken || !outputToken) { setFlowMessage(t('wallet.select_valid')); return; }
    if (inputToken.mint === outputToken.mint) { setFlowMessage(t('wallet.same_token')); return; }
    const parsedAmount = Number(swapAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFlowMessage(t('wallet.invalid_amount')); return; }
    setIsPreparing(true); setPreparedSwap(null); setSimulationError(""); setSimulationLogs([]); setTxSignature(""); setUserConfirmedSend(false);
    try {
      const amountRaw = toRawAmount(parsedAmount, inputToken.decimals);
      const response = await fetch(`${CORE_API_URL}/v1/solana/swap/prepare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_public_key: walletAddress, input_mint: inputToken.mint, output_mint: outputToken.mint, amount_raw: amountRaw, slippage_bps: 50 }),
      });
      if (!response.ok) throw new Error(await response.text());
      const payload: SwapPrepareResponse = await response.json();
      setPreparedSwap(payload);
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const tx = VersionedTransaction.deserialize(base64ToBytes(payload.swap_transaction_base64));
      const simulation = await conn.simulateTransaction(tx, { sigVerify: false });
      if (simulation.value.err) setSimulationError(JSON.stringify(simulation.value.err));
      setSimulationLogs(simulation.value.logs || []);
      setFlowMessage(t('wallet.prepare_success'));
    } catch (e) { setFlowMessage(e instanceof Error ? e.message : t('wallet.prepare_error')); }
    finally { setIsPreparing(false); }
  };

  const inputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === inputMint) || SWAP_TOKEN_OPTIONS[0];
  const outputToken = SWAP_TOKEN_OPTIONS.find((t) => t.mint === outputMint) || SWAP_TOKEN_OPTIONS[1];
  const quoteSummary = preparedSwap
    ? getQuoteSummary(preparedSwap.quote, outputToken.decimals)
    : { outAmountUi: 0, priceImpactPct: 0, minOutAmountUi: 0, routeHops: 0, slippageBps: 0 };

  const handleSignAndSend = async () => {
    if (!preparedSwap?.swap_transaction_base64) { setFlowMessage(t('wallet.connect_first')); return; }
    if (!userConfirmedSend) { setFlowMessage(t('wallet.confirm_first')); return; }
    const provider = getPhantomProvider();
    if (!provider) { setFlowMessage(t('wallet.phantom_missing')); return; }
    setIsSending(true);
    try {
      const conn = new Connection(clusterApiUrl("devnet"), "confirmed");
      const tx = VersionedTransaction.deserialize(base64ToBytes(preparedSwap.swap_transaction_base64));
      const signed = await provider.signTransaction(tx);
      const signature = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      await conn.confirmTransaction(signature, "confirmed");
      setTxSignature(signature);
      setFlowMessage(t('wallet.tx_success'));
    } catch (e) { setFlowMessage(e instanceof Error ? e.message : t('wallet.tx_error')); }
    finally { setIsSending(false); }
  };

  return (
    <>
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${animateIn ? "bg-black/40 backdrop-blur-md" : "bg-black/0"}`}
          onClick={closeModal}
        >
          <div
            className={`relative bg-white rounded-3xl shadow-2xl border border-pink-100 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 transform ${animateIn ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Floating decorative */}
            <div className="absolute bottom-16 right-8 text-base animate-pulse pointer-events-none select-none z-0 opacity-40">💎</div>

            {/* ── Header ── */}
            <div className="px-6 pt-6 pb-4 border-b border-pink-100/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-400 to-fuchsia-500 shadow-md shadow-pink-200 flex items-center justify-center text-white">
                    <IconWallet />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent leading-tight">
                      {t('wallet.title')}
                    </h2>
                    <p className="text-xs text-fuchsia-600 font-medium mt-0.5">{t('wallet.subtitle')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleRefresh} disabled={isRefreshing} title="Atualizar saldos"
                    className="p-2 rounded-xl text-fuchsia-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all duration-200 disabled:opacity-40">
                    <IconRefresh spinning={isRefreshing} />
                  </button>
                  <button onClick={() => { setWalletAddress(""); localStorage.removeItem("connected_wallet"); setFlowMessage(t('wallet.disconnect')); }}
                    title={t('wallet.disconnect')}
                    className="p-2 rounded-xl text-pink-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200">
                    <IconDisconnect />
                  </button>
                  <button onClick={closeModal} title="Fechar"
                    className="p-2 rounded-xl text-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-all duration-200">
                    <IconClose />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Balance hero ── */}
            <div className="mx-6 mt-5 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 p-6 text-center shadow-lg shadow-pink-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 rounded-2xl" />
              <p className="text-xs font-semibold text-white uppercase tracking-widest mb-2">{t('wallet.total_balance')}</p>
              {isFetchingBalance ? (
                <div className="flex justify-center"><IconRefresh spinning /></div>
              ) : (
                <p className="text-5xl font-black text-white drop-shadow-sm">
                  {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : formatCurrency(getMyBalance())}
                </p>
              )}
              <p className="text-xs text-white/90 mt-2 font-semibold">{t('wallet.network')}</p>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">

              {/* Token list */}
              <div className="mt-5 mb-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-3">{t('wallet.your_tokens')}</h3>
                <div className="space-y-2">
                  {solBalance !== null && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-pink-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">◎</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800">SOL</p>
                        <p className="text-xs text-gray-500 font-medium">{t('wallet.network')}</p>
                      </div>
                      <p className="font-bold text-gray-800">{solBalance.toFixed(6)} SOL</p>
                    </div>
                  )}
                  {Array.isArray(balance) && balance.map((tok) => (
                    <div key={tok.token} className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-pink-200 shadow-sm hover:border-fuchsia-300 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-400 to-pink-400 flex items-center justify-center text-white font-bold flex-shrink-0">$</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800">{tok.token}</p>
                        <p className="text-xs text-gray-500 font-medium">{tok.balance.toLocaleString()} tokens</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">${tok.valueUSD.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 font-medium">${tok.priceUSD.toFixed(4)} each</p>
                      </div>
                    </div>
                  ))}
                  {solBalance === null && (!balance || balance.length === 0) && (
                    <div className="text-center py-8">
                      <div className="text-5xl mb-3">🐣</div>
                      <p className="font-bold text-gray-700">{t('wallet.no_tokens')}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{t('wallet.no_tokens_sub')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Swap section */}
              <div className="border-t border-pink-100 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-400 to-fuchsia-500 flex items-center justify-center text-white">
                    <IconSwap />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest">{t('wallet.swap_title')}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button onClick={handleConnectWallet}
                    className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      walletAddress
                        ? "bg-emerald-50 text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-100"
                        : "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-md shadow-pink-200 hover:shadow-pink-300 hover:scale-105 active:scale-95"
                    }`}>
                    <span className="flex items-center justify-center gap-1.5">
                      {walletAddress ? <><IconCheck /> {t('wallet.connected')}</> : t('wallet.connect_phantom')}
                    </span>
                  </button>
                  <input value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border-2 border-pink-200 bg-white text-gray-700 font-medium text-sm focus:outline-none focus:border-fuchsia-400 transition-colors"
                    placeholder={`${t('wallet.qty')} ${inputToken.symbol}`} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: t('wallet.input_token'), value: inputMint, onChange: setInputMint },
                    { label: t('wallet.output_token'), value: outputMint, onChange: setOutputMint },
                  ].map(({ label, value, onChange }) => (
                    <label key={label} className="block">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</span>
                      <select value={value} onChange={(e) => onChange(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-pink-200 bg-white text-gray-700 font-medium text-sm focus:outline-none focus:border-fuchsia-400 transition-colors">
                        {SWAP_TOKEN_OPTIONS.map((t) => (
                          <option key={t.mint} value={t.mint}>{t.symbol}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3 mb-3">
                  <button onClick={handlePrepareAndSimulate} disabled={isPreparing || !walletAddress}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-semibold text-sm shadow-md shadow-pink-200 hover:shadow-pink-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <IconZap />
                    {isPreparing ? t('wallet.preparing') : t('wallet.prepare')}
                  </button>
                  <button onClick={handleSignAndSend} disabled={isSending || !preparedSwap || Boolean(simulationError) || !userConfirmedSend}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-200 hover:shadow-emerald-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <IconCheck />
                    {isSending ? t('wallet.sending') : t('wallet.sign_send')}
                  </button>
                </div>

                {preparedSwap && (
                  <label className="flex items-center gap-2 mb-3 text-sm font-semibold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 rounded-xl px-3 py-2.5 cursor-pointer">
                    <input type="checkbox" checked={userConfirmedSend} onChange={(e) => setUserConfirmedSend(e.target.checked)} className="accent-emerald-500 w-4 h-4" />
                    {t('wallet.confirm_text')}
                  </label>
                )}

                {preparedSwap && (
                  <div className="mb-3 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">{t('wallet.exec_summary')}</p>
                    <div className="space-y-1 text-xs text-amber-700">
                      <p>{t('wallet.route')} {inputToken.symbol} → {outputToken.symbol}</p>
                      <p>{t('wallet.input')} {swapAmount || "0"} {inputToken.symbol}</p>
                      <p>{t('wallet.estimated_output')} {quoteSummary.outAmountUi.toFixed(6)} {outputToken.symbol}</p>
                      <p>{t('wallet.min_output')} {quoteSummary.minOutAmountUi.toFixed(6)} {outputToken.symbol}</p>
                      <p>{t('wallet.price_impact')} {(quoteSummary.priceImpactPct * 100).toFixed(4)}% | Slippage: {(quoteSummary.slippageBps / 100).toFixed(2)}%</p>
                      <p>{t('wallet.cluster')} {preparedSwap.cluster}</p>
                    </div>
                  </div>
                )}

                {simulationError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 text-sm">
                    {simulationError}
                  </div>
                )}

                {simulationLogs.length > 0 && (
                  <details className="mb-3">
                    <summary className="text-xs font-bold cursor-pointer text-gray-700 uppercase tracking-wide mb-1">{t('wallet.sim_logs')} ({simulationLogs.length})</summary>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 max-h-28 overflow-auto text-xs text-gray-600 space-y-1 mt-1">
                      {simulationLogs.map((line, idx) => <p key={`${idx}-${line}`}>{line}</p>)}
                    </div>
                  </details>
                )}

                {txSignature && (
                  <div className="mb-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-xs font-mono break-all">
                    Tx: {txSignature}
                  </div>
                )}

                {flowMessage && (
                  <div className="p-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-700 text-sm">
                    {flowMessage}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-3 border-t border-pink-100/60 bg-gradient-to-r from-pink-50/60 to-fuchsia-50/60">
              <div className="flex items-center justify-center gap-1.5 text-xs text-fuchsia-500 font-semibold">
                <IconShield />
                <span>{t('wallet.secured')}</span>
                <span>🌸</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Wallet;
