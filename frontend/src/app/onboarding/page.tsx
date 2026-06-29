"use client";

/**
 * Creator Onboarding — RFB-06
 *
 * Fluxo 0-fricção: 2 inputs + 1 clique → elegível para receber USDC.
 * Passos para vídeo:
 *   1. Abrir /onboarding
 *   2. Preencher @handle e Circle Wallet ID
 *   3. Clicar "Register as Creator"
 *   4. Ver tela de sucesso com confirmação de elegibilidade
 *   5. Navegar para /traction para ver o dashboard ao vivo
 */

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar/Navbar";
import { ThemeProviderWrapper } from "@/providers/ThemeProvider";
import { registerCreator, CreatorRegisterResult } from "@/api/api";

type Step = "form" | "loading" | "success" | "error";

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconWallet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M5 12h14m-7-7 7 7-7 7"/>
  </svg>
);
const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

// ── Main page ──────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("form");
  const [handle, setHandle] = useState("");
  const [walletId, setWalletId] = useState("");
  const [result, setResult] = useState<CreatorRegisterResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@/, "");
    const w = walletId.trim();
    if (!h || !w) return;

    setStep("loading");
    try {
      const data = await registerCreator(h, w);
      setResult(data);
      setStep("success");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Registration failed. Please try again.";
      setErrorMsg(msg);
      setStep("error");
    }
  };

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-12 max-w-md">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-500 text-white shadow-lg mb-4">
              <IconDollar />
            </div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent leading-tight mb-2">
              Become a Creator
            </h1>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              Register once. The agent pays you USDC automatically for your content.
            </p>
          </div>

          {/* ── Form state ──────────────────────────────────────────── */}
          {(step === "form" || step === "loading") && (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm p-6 flex flex-col gap-5">

              {/* Handle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-fuchsia-400"><IconUser /></span>
                  Your @handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm select-none">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                    placeholder="yourcreatorhandle"
                    required
                    disabled={step === "loading"}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-300 disabled:opacity-60 transition"
                  />
                </div>
              </div>

              {/* Circle Wallet ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-fuchsia-400"><IconWallet /></span>
                  Circle Wallet ID
                </label>
                <input
                  type="text"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  placeholder="Paste your Circle App Kit wallet ID"
                  required
                  disabled={step === "loading"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-300 disabled:opacity-60 transition"
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  Don&apos;t have one?{" "}
                  <span className="text-fuchsia-500 font-semibold">Circle App Kit integration coming — contact f0ntz</span>
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={step === "loading" || !handle.trim() || !walletId.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-bold shadow-lg hover:from-fuchsia-600 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-fuchsia-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {step === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Registering…
                  </>
                ) : (
                  <>
                    Register as Creator
                    <IconArrow />
                  </>
                )}
              </button>

              {/* What happens next */}
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">What happens next</p>
                {[
                  "Your handle is linked to your Circle wallet",
                  "The XiaoLee agent discovers your content",
                  "USDC payments land automatically — no action needed",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="w-4 h-4 rounded-full bg-fuchsia-100 text-fuchsia-500 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">
                      {i + 1}
                    </span>
                    {s}
                  </div>
                ))}
              </div>
            </form>
          )}

          {/* ── Success state ────────────────────────────────────────── */}
          {step === "success" && result && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm p-8 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                <IconCheck />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-emerald-800 mb-1">
                  {result.already_registered ? "Already registered!" : "You're in!"}
                </h2>
                <p className="text-sm text-emerald-700 font-semibold">{result.creator}</p>
                <p className="text-sm text-emerald-600 mt-1">
                  is now eligible to receive USDC payments from the XiaoLee agent.
                </p>
              </div>

              <div className="w-full rounded-xl bg-white border border-emerald-100 p-4 text-left flex flex-col gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registration details</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Handle</span>
                  <span className="font-bold text-gray-800">{result.creator}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Wallet</span>
                  <span className="font-mono text-gray-600 truncate max-w-[160px]">{result.circle_wallet_id.slice(0, 20)}…</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Registered at</span>
                  <span className="text-gray-600">{new Date(result.registered_at).toLocaleTimeString()}</span>
                </div>
              </div>

              <Link
                href="/traction"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-bold shadow-lg hover:from-fuchsia-600 hover:to-purple-700 transition-all duration-200 hover:scale-[1.02]"
              >
                <IconActivity />
                View Live Traction Dashboard
              </Link>

              <button
                onClick={() => { setStep("form"); setHandle(""); setWalletId(""); setResult(null); }}
                className="text-xs text-gray-400 hover:text-fuchsia-500 transition-colors"
              >
                Register another creator
              </button>
            </div>
          )}

          {/* ── Error state ──────────────────────────────────────────── */}
          {step === "error" && (
            <div className="rounded-2xl border border-red-100 bg-red-50 shadow-sm p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-red-700 mb-1">Registration failed</h2>
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep("form")}
                className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <p className="text-center text-xs text-gray-400 font-medium uppercase tracking-widest mt-8">
            Arc Lepton · RFB-06 · XiaoLee Core
          </p>

        </main>
      </div>
    </ThemeProviderWrapper>
  );
}
