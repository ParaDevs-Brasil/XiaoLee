"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WalletProps } from "@/interfaces";
import { useModal } from "@/hooks/useModal";
import api from "@/api/api";
import { getStoredConnectedWallet } from "@/lib/walletProviders";
import {
  clearStoredEvmAddress,
  connectEvmWallet,
  getEvmChainName,
  getStoredEvmAddress,
  isEvmWalletInstalled,
  shortEvmAddress,
} from "@/lib/evmWallet";

const Wallet: React.FC<WalletProps> = ({ balance = [], shouldOpen = false, onClose }) => {
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const [address, setAddress] = useState<string>("");
  const [chainName, setChainName] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  // Saldo USDC on-chain no Arc (lido pelo backend via RPC) — null = indisponível
  const [arcUsdc, setArcUsdc] = useState<number | null>(null);

  const loadChain = useCallback(async () => {
    setChainName(await getEvmChainName());
  }, []);

  useEffect(() => {
    // Wallet universal (Connect Wallet) tem prioridade; chave EVM legada como fallback
    const connected = getStoredConnectedWallet();
    const saved = connected?.address?.startsWith("0x") ? connected.address : getStoredEvmAddress();
    if (saved) setAddress(saved);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && address) loadChain();
  }, [isOpen, address, loadChain]);

  useEffect(() => {
    if (!isOpen || !address || !address.startsWith("0x")) return;
    setArcUsdc(null);
    api
      .get<{ usdc_balance: number }>(`/v1/arc/balance/${address}`)
      .then((resp) => setArcUsdc(resp.data.usdc_balance))
      .catch(() => setArcUsdc(null));
  }, [isOpen, address]);

  const handleConnect = async () => {
    if (!isEvmWalletInstalled()) {
      setStatusMsg("Carteira EVM não encontrada. Instale a MetaMask (ou compatível) e recarregue.");
      return;
    }
    setIsConnecting(true);
    try {
      const addr = await connectEvmWallet();
      setAddress(addr);
      setStatusMsg("Carteira conectada!");
      await loadChain();
    } catch (err) {
      setStatusMsg(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredEvmAddress();
    setAddress("");
    setChainName("");
    setStatusMsg("Carteira desconectada.");
  };

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rewardTokens = Array.isArray(balance) ? balance : [];
  const totalUSD = rewardTokens.reduce((sum, t) => sum + (t.valueUSD ?? 0), 0);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={closeModal}
    >
      <div
        className={`bg-white rounded-3xl shadow-e3 border border-[var(--border)] max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
          animateIn ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="border-b border-[var(--border)]">
          <div className="px-6 pt-6 flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--ink)]">
                💰 XiaoLee <span className="text-grad">Wallet</span>
              </h2>
              <p className="text-sm text-[var(--ink-2)]">XiaoLee · USDC · x402</p>
            </div>
            <div className="flex items-center gap-2">
              {address && (
                <button
                  onClick={handleDisconnect}
                  title="Desconectar"
                  className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              )}
              <button onClick={closeModal} className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-[var(--ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Token strip — trilhos XiaoLee */}
          <div className="flex items-stretch divide-x divide-[var(--border)]">
            {[
              { symbol: "USDC", network: "XiaoLee", icon: "$" },
              { symbol: "Rewards", network: "XiaoLee", icon: "✦" },
            ].map((t) => (
              <div key={t.symbol} className="flex-1 flex items-center gap-2 px-4 py-2 bg-[var(--bg)] hover:bg-[var(--accent-soft)] transition-colors">
                <span className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {t.icon}
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--ink)] leading-none">{t.symbol}</p>
                  <p className="text-[10px] text-[var(--accent)] leading-none mt-0.5">{t.network}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Total Balance */}
          <div className="mx-6 my-4 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl p-6">
            <p className="text-sm text-[var(--ink-2)] mb-2">Total Balance</p>
            {address ? (
              <>
                <p className="text-5xl font-bold text-[var(--accent)]">
                  ${((arcUsdc ?? 0) + totalUSD).toFixed(2)}
                </p>
                <p className="text-sm text-[var(--ink-2)] mt-1">
                  {arcUsdc != null
                    ? `${arcUsdc.toFixed(2)} USDC no Arc${totalUSD > 0 ? " + recompensas" : ""}`
                    : `Recompensas XiaoLee${chainName ? ` · ${chainName}` : ""}`}
                </p>
              </>
            ) : (
              <p className="text-lg text-[var(--ink-2)]">Conecte sua carteira</p>
            )}
          </div>

          {/* Account pill */}
          {address && (
            <div className="mx-6 mb-4 flex items-center justify-between bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2">
              <div>
                <p className="text-xs font-mono font-semibold text-[var(--ink)]">{shortEvmAddress(address, 8, 6)}</p>
                <p className="text-[10px] text-[var(--ink-2)]">
                  XiaoLee{chainName ? ` · ${chainName}` : ""}
                </p>
              </div>
              <button onClick={handleCopyAddress} className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                {copied ? "✓ copiado" : "copiar"}
              </button>
            </div>
          )}
        </div>

        {/* ── Token List ────────────────────────────────────────────── */}
        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4">
          {!address ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">✦</div>
              <p className="text-[var(--ink-2)] text-sm mb-5">
                Conecte sua carteira para ver seus saldos e recompensas XiaoLee
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-8 py-2.5 rounded-xl btn-primary text-white font-semibold disabled:opacity-50 transition-all"
              >
                {isConnecting ? "Conectando..." : "Conectar Carteira"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-[var(--ink)] flex items-center gap-2">
                💎 Your Tokens
              </h3>

              {/* USDC on-chain no Arc */}
              {arcUsdc != null && (
                <div className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg flex items-center justify-center text-lg">$</div>
                      <div>
                        <p className="font-semibold text-[var(--ink)]">USDC</p>
                        <p className="text-xs text-[var(--ink-2)]">Arc Testnet · on-chain</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[var(--ink)]">{arcUsdc.toFixed(2)} USDC</p>
                  </div>
                </div>
              )}

              {/* Campaign reward tokens */}
              {rewardTokens.map((tokenData) => (
                <div key={tokenData.token} className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg flex items-center justify-center text-lg">💰</div>
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{tokenData.token}</p>
                        <p className="text-xs text-[var(--ink-2)]">{tokenData.balance.toLocaleString()} tokens</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[var(--ink)]">${tokenData.valueUSD.toFixed(2)}</p>
                  </div>
                </div>
              ))}

              {rewardTokens.length === 0 && (
                <p className="text-xs text-[var(--ink-2)] text-center py-3">
                  Sem recompensas ainda — participe de uma campanha XiaoLee para ganhar tokens.
                </p>
              )}
            </div>
          )}

          {statusMsg && (
            <div className={`p-3 rounded-xl text-sm border ${
              statusMsg.startsWith("Erro") || statusMsg.includes("não encontrada")
                ? "bg-[var(--accent-soft)] border-[var(--danger)]/30 text-[var(--danger)]"
                : "bg-[var(--accent-soft)] border-[var(--border)] text-[var(--ink)]"
            }`}>
              {statusMsg}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg)]">
          <p className="text-center text-sm text-[var(--ink-2)]">
            Secured by XiaoLee · USDC · x402
          </p>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
