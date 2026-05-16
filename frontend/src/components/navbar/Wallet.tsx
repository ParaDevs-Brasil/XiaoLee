"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WalletProps } from "@/interfaces";
import { useModal } from "@/hooks/useModal";
import {
  connectFreighter,
  getStellarBalance,
  isFreighterInstalled,
  type StellarBalance,
} from "@/utils/stellar";

function truncateAddress(addr: string) {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

const Wallet: React.FC<WalletProps> = ({ balance = [], shouldOpen = false, onClose }) => {
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const [account, setAccount] = useState<string>("");
  const [stellarBalance, setStellarBalance] = useState<StellarBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const loadBalance = useCallback(async (addr: string) => {
    setIsLoading(true);
    try {
      setStellarBalance(await getStellarBalance(addr));
    } catch (err) {
      setStatusMsg(`Erro ao carregar saldo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("stellar_account");
    if (saved) setAccount(saved);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && account) loadBalance(account);
  }, [isOpen, account, loadBalance]);

  const handleConnect = async () => {
    const installed = await isFreighterInstalled();
    if (!installed) {
      setStatusMsg("Freighter não encontrado. Instale em freighter.app e recarregue.");
      return;
    }
    try {
      const publicKey = await connectFreighter();
      setAccount(publicKey);
      localStorage.setItem("stellar_account", publicKey);
      setStatusMsg("Freighter conectado!");
      await loadBalance(publicKey);
    } catch (err) {
      setStatusMsg(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRefresh = async () => {
    if (!account) return;
    setIsRefreshing(true);
    try { await loadBalance(account); } finally { setIsRefreshing(false); }
  };

  const handleDisconnect = () => {
    setAccount(""); setStellarBalance(null);
    localStorage.removeItem("stellar_account");
    localStorage.removeItem("stellar_jwt");
    setStatusMsg("Carteira desconectada.");
  };

  const handleCopyAddress = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const xlm = stellarBalance?.xlm ?? 0;
  const usdc = stellarBalance?.assets.find((a) => a.asset_code === "USDC")?.balance ?? 0;
  const otherAssets = stellarBalance?.assets.filter((a) => a.asset_code !== "USDC") ?? [];

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={closeModal}
    >
      <div
        className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-2xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
          animateIn ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="border-b border-[var(--modal-footer-border)]">
          <div className="px-6 pt-6 flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                💰 My Wallet
              </h2>
              <p className="text-sm text-[var(--modal-header-subtitle)]">Freighter · Stellar Testnet</p>
            </div>
            <div className="flex items-center gap-2">
              {account && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoading}
                  className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-5 h-5 text-blue-400 ${isRefreshing || isLoading ? "animate-spin" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              {account && (
                <button
                  onClick={handleDisconnect}
                  className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              )}
              <button onClick={closeModal} className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Token strip — Stellar */}
          <div className="flex items-stretch divide-x divide-sky-100/60">
            {[
              { symbol: "XLM",  name: "Stellar Lumens", icon: "★", bg: "from-sky-400 to-blue-500" },
              { symbol: "USDC", name: "USD Coin",        icon: "$",  bg: "from-indigo-400 to-violet-400" },
            ].map((t) => (
              <div key={t.symbol} className="flex-1 flex items-center gap-2 px-4 py-2 bg-sky-50/40 hover:bg-sky-100/40 transition-colors">
                <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${t.bg} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {t.icon}
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--token-card-title)] leading-none">{t.symbol}</p>
                  <p className="text-[10px] text-sky-400 leading-none mt-0.5">Stellar</p>
                </div>
              </div>
            ))}
          </div>

          {/* Total Balance */}
          <div className="mx-6 my-4 text-center bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-6">
            <p className="text-sm text-[var(--modal-header-subtitle)] mb-2">Total Balance</p>
            {account && stellarBalance ? (
              <>
                <p className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                  {xlm.toFixed(4)} XLM
                </p>
                <p className="text-sm text-[var(--modal-header-subtitle)] mt-1">
                  {usdc > 0 ? `+ ${usdc.toFixed(2)} USDC · ` : ""}Stellar Testnet
                </p>
              </>
            ) : account && isLoading ? (
              <p className="text-2xl text-[var(--modal-header-subtitle)] animate-pulse">carregando...</p>
            ) : (
              <p className="text-lg text-[var(--modal-header-subtitle)]">Conecte a Freighter</p>
            )}
          </div>

          {/* Account pill */}
          {account && (
            <div className="mx-6 mb-4 flex items-center justify-between bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] border border-[var(--token-card-border)] rounded-xl px-4 py-2">
              <div>
                <p className="text-xs font-mono font-semibold text-[var(--token-card-title)]">{truncateAddress(account)}</p>
                <p className="text-[10px] text-[var(--modal-header-subtitle)]">Freighter · Stellar Testnet</p>
              </div>
              <button onClick={handleCopyAddress} className="text-xs text-sky-500 hover:text-sky-700 transition-colors">
                {copied ? "✓ copiado" : "copiar"}
              </button>
            </div>
          )}
        </div>

        {/* ── Token List ────────────────────────────────────────────── */}
        <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4">
          {!account ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">✦</div>
              <p className="text-[var(--modal-header-subtitle)] text-sm mb-5">
                Conecte sua carteira Freighter para ver seus tokens na Stellar Testnet
              </p>
              <button
                onClick={handleConnect}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold hover:opacity-90 transition-all"
              >
                Conectar Freighter
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-[var(--modal-section-title)] flex items-center gap-2">
                💎 Your Tokens
              </h3>

              {/* XLM */}
              <div className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)] hover:border-[var(--token-card-border-hover)] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-base shrink-0">★</span>
                    <div>
                      <p className="font-semibold text-[var(--token-card-title)]">XLM</p>
                      <p className="text-xs text-[var(--token-balance-label)]">Stellar Lumens · Testnet</p>
                    </div>
                  </div>
                  <p className="font-semibold text-[var(--token-value-amount)]">
                    {isLoading ? <span className="text-xs animate-pulse text-[var(--modal-header-subtitle)]">...</span> : `${xlm.toFixed(4)} XLM`}
                  </p>
                </div>
              </div>

              {/* USDC */}
              {stellarBalance && (
                <div className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)] hover:border-[var(--token-card-border-hover)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white font-bold text-base shrink-0">$</span>
                      <div>
                        <p className="font-semibold text-[var(--token-card-title)]">USDC</p>
                        <p className="text-xs text-[var(--token-balance-label)]">USD Coin · Stellar Testnet</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[var(--token-value-amount)]">
                      {isLoading ? <span className="text-xs animate-pulse text-[var(--modal-header-subtitle)]">...</span> : `${usdc.toFixed(2)} USDC`}
                    </p>
                  </div>
                </div>
              )}

              {/* Other Stellar assets */}
              {otherAssets.map((asset) => (
                <div key={asset.asset_code} className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {asset.asset_code.slice(0, 2)}
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--token-card-title)]">{asset.asset_code}</p>
                        <p className="text-xs text-[var(--token-balance-label)] font-mono">{asset.asset_issuer.slice(0, 10)}...</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[var(--token-value-amount)]">{asset.balance.toFixed(4)}</p>
                  </div>
                </div>
              ))}

              {/* Campaign reward tokens */}
              {Array.isArray(balance) && balance.map((tokenData) => (
                <div key={tokenData.token} className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-[var(--token-icon-bg-start)] to-[var(--token-icon-bg-end)] rounded-lg flex items-center justify-center text-lg">💰</div>
                      <div>
                        <p className="font-semibold text-[var(--token-card-title)]">{tokenData.token}</p>
                        <p className="text-xs text-[var(--token-balance-label)]">{tokenData.balance.toLocaleString()} tokens</p>
                      </div>
                    </div>
                    <p className="font-semibold text-[var(--token-value-amount)]">${tokenData.valueUSD.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {statusMsg && (
            <div className={`p-3 rounded-xl text-sm ${statusMsg.startsWith("Erro") ? "bg-red-50 border border-red-200 text-red-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
              {statusMsg}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-[var(--modal-footer-border)] bg-gradient-to-r from-[var(--modal-footer-bg-start)] to-[var(--modal-footer-bg-end)]">
          <p className="text-center text-sm text-[var(--modal-footer-text)]">
            Secured by XiaoLee · Stellar Testnet · Freighter
          </p>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
