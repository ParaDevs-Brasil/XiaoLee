"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar/Navbar";
import { ThemeProviderWrapper } from "@/providers/ThemeProvider";
import { useLanguage } from "@/contexts/LanguageContext";
import { registerCreator, CreatorRegisterResult } from "@/api/api";
import { IconUser, IconWallet, IconCheck, IconDollar, IconArrow, IconActivity } from "@/components/icons";

type Step = "form" | "loading" | "success" | "error";

export default function OnboardingPage() {
  const { t } = useLanguage();
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
        t("onboarding.error_wallet");
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
              <IconDollar className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent leading-tight mb-2">
              {t("onboarding.title")}
            </h1>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              {t("onboarding.subtitle")}
            </p>
          </div>

          {/* ── Form state ──────────────────────────────────────────── */}
          {(step === "form" || step === "loading") && (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm p-6 flex flex-col gap-5">

              {/* Handle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-fuchsia-400"><IconUser className="w-5 h-5" /></span>
                  {t("onboarding.handle_label")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm select-none">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                    placeholder={t("onboarding.handle_placeholder")}
                    required
                    disabled={step === "loading"}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-300 disabled:opacity-60 transition"
                  />
                </div>
              </div>

              {/* EVM Wallet */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="text-fuchsia-400"><IconWallet className="w-5 h-5" /></span>
                  {t("onboarding.wallet_label")}
                </label>
                <input
                  type="text"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  placeholder={t("onboarding.wallet_placeholder")}
                  required
                  disabled={step === "loading"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-300 disabled:opacity-60 transition"
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  {t("onboarding.wallet_hint_no_wallet")}{" "}
                  <span className="text-fuchsia-500 font-semibold">{t("onboarding.wallet_hint_coming")}</span>
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
                    {t("onboarding.submitting")}
                  </>
                ) : (
                  <>
                    {t("onboarding.submit")}
                    <IconArrow className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* What happens next */}
              <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("onboarding.what_next")}</p>
                {[t("onboarding.next_1"), t("onboarding.next_2"), t("onboarding.next_3")].map((s, i) => (
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
                <IconCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-emerald-800 mb-1">
                  {result.already_registered ? t("onboarding.success_existing") : t("onboarding.success_new")}
                </h2>
                <p className="text-sm text-emerald-700 font-semibold">{result.creator}</p>
                <p className="text-sm text-emerald-600 mt-1">{t("onboarding.success_eligible")}</p>
              </div>

              <div className="w-full rounded-xl bg-white border border-emerald-100 p-4 text-left flex flex-col gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t("onboarding.success_details")}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("onboarding.success_handle")}</span>
                  <span className="font-bold text-gray-800">{result.creator}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("onboarding.success_wallet")}</span>
                  <span className="font-mono text-gray-600 truncate max-w-[160px]">{result.circle_wallet_id.slice(0, 20)}…</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("onboarding.success_at")}</span>
                  <span className="text-gray-600">{new Date(result.registered_at).toLocaleTimeString()}</span>
                </div>
              </div>

              <Link
                href="/traction"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-bold shadow-lg hover:from-fuchsia-600 hover:to-purple-700 transition-all duration-200 hover:scale-[1.02]"
              >
                <IconActivity className="w-4 h-4" />
                {t("onboarding.success_cta")}
              </Link>

              <button
                onClick={() => { setStep("form"); setHandle(""); setWalletId(""); setResult(null); }}
                className="text-xs text-gray-400 hover:text-fuchsia-500 transition-colors"
              >
                {t("onboarding.register_another")}
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
                <h2 className="text-base font-bold text-red-700 mb-1">{t("onboarding.error_title")}</h2>
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep("form")}
                className="px-6 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
              >
                {t("onboarding.error_retry")}
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
