import React, { useState } from "react";
import { WalletProps } from "@/interfaces";
import { formatCurrency } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";
import { Connection, clusterApiUrl, VersionedTransaction } from "@solana/web3.js";
import {
  getQuoteSummary,
  SWAP_TOKEN_OPTIONS,
  toRawAmount,
} from "@/utils/swap";

const CORE_API_URL = process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:8000";

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
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const getMyBalance = () => {
    // Calculate total balance from all tokens
    if (balance && Array.isArray(balance)) {
      return balance.reduce((total, token) => {
        return total + (token.valueUSD || 0);
      }, 0);
    }
    return 0;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Component will refresh automatically
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
      setWalletAddress(resp.publicKey.toString());
      setFlowMessage("Carteira conectada na Solana Devnet.");
    } catch {
      setFlowMessage("Nao foi possivel conectar a carteira.");
    }
  };

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

      if (simulation.value.err) {
        setSimulationError(JSON.stringify(simulation.value.err));
      }

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
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Falha ao assinar/enviar transacao.";
      setFlowMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Wallet Modal */}
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-5xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
              animateIn
                ? "scale-100 opacity-100 translate-y-0"
                : "scale-95 opacity-0 translate-y-4"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--modal-footer-border)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                    💰 My Wallet
                  </h2>
                  <p className="text-[var(--modal-header-subtitle)]">
                    Your crypto balance
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-label="Atualizar saldos"
                    title="Atualizar saldos"
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg
                      className={`w-5 h-5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={closeModal}
                    aria-label="Fechar carteira"
                    title="Fechar carteira"
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Total Balance */}
              <div className="text-center bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-6">
                <p className="text-sm text-[var(--modal-header-subtitle)] mb-2">
                  Total Balance
                </p>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                  {formatCurrency(getMyBalance())}
                </p>
              </div>
            </div>

            {/* Token List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {balance && Array.isArray(balance) && balance.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-[var(--modal-section-title)] mb-4 flex items-center">
                    💎 Your Tokens ({balance.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {balance.map((tokenData) => (
                      <div
                        key={tokenData.token}
                        className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)] hover:border-[var(--token-card-border-hover)] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-[var(--token-icon-bg-start)] to-[var(--token-icon-bg-end)] rounded-lg flex items-center justify-center text-lg">
                              💰
                            </div>
                            <div>
                              <h4 className="font-semibold text-[var(--token-card-title)]">
                                {tokenData.token}
                              </h4>
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
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🐣</div>
                  <h3 className="text-xl font-semibold text-[var(--modal-section-title)] mb-2">
                    No tokens yet!
                  </h3>
                  <p className="text-[var(--modal-header-subtitle)]">
                    Start earning tokens through campaigns
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
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
                      <option key={token.mint} value={token.mint}>
                        {token.symbol}
                      </option>
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
                      <option key={token.mint} value={token.mint}>
                        {token.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col md:flex-row gap-3 mb-4">
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
                <div className="mb-3 p-3 rounded-xl bg-white/70 border border-[var(--token-card-border)]">
                  <p className="text-sm text-[var(--token-info-label)]">Cluster: {preparedSwap.cluster}</p>
                  <p className="text-sm text-[var(--token-info-label)]">{preparedSwap.disclaimer}</p>
                </div>
              )}

              <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-800 mb-1">Resumo de risco e execucao</p>
                <p className="text-xs text-amber-700">
                  Rota: {inputToken.symbol} {"->"} {outputToken.symbol}
                </p>
                <p className="text-xs text-amber-700">
                  Valor de entrada: {swapAmount || "0"} {inputToken.symbol}
                </p>
                <p className="text-xs text-amber-700">
                  Saida estimada: {quoteSummary.outAmountUi.toFixed(6)} {outputToken.symbol}
                </p>
                <p className="text-xs text-amber-700">
                  Minimo estimado: {quoteSummary.minOutAmountUi.toFixed(6)} {outputToken.symbol}
                </p>
                <p className="text-xs text-amber-700">
                  Price impact estimado: {(quoteSummary.priceImpactPct * 100).toFixed(4)}%
                </p>
                <p className="text-xs text-amber-700">
                  Slippage configurado: {(quoteSummary.slippageBps / 100).toFixed(2)}%
                </p>
                <p className="text-xs text-amber-700">
                  Saltos de rota (Jupiter): {quoteSummary.routeHops}
                </p>
                <p className="text-xs text-amber-700 break-all">Carteira: {walletAddress || "nao conectada"}</p>
                <p className="text-xs text-amber-700">
                  Envio na Devnet somente apos simulacao sem erro e confirmacao manual.
                </p>
              </div>

              <label className="flex items-start gap-2 mb-3 text-sm text-[var(--token-info-label)]">
                <input
                  type="checkbox"
                  checked={userConfirmedSend}
                  onChange={(e) => setUserConfirmedSend(e.target.checked)}
                />
                Confirmo que revisei a simulacao e quero enviar esta transacao na Devnet.
              </label>

              {simulationError && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  Erro na simulacao: {simulationError}
                </div>
              )}

              {simulationLogs.length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-sm font-semibold mb-2">Logs da simulacao:</p>
                  <div className="max-h-28 overflow-auto text-xs text-slate-700 space-y-1">
                    {simulationLogs.map((line, idx) => (
                      <p key={`${idx}-${line}`}>{line}</p>
                    ))}
                  </div>
                </div>
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
