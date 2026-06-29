"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar/Navbar";
import { ThemeProviderWrapper } from "@/providers/ThemeProvider";

const API = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────
interface PaymentEvent {
  intent_id: string;
  amount: number;
  creator: string;
  tx: string;
  ts: string;
  latency_ms: number;
}

interface TractionSnapshot {
  total_usdc: number;
  total_payments: number;
  active_creators: number;
  registered_creators: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  feed: PaymentEvent[];
}

const EMPTY: TractionSnapshot = {
  total_usdc: 0,
  total_payments: 0,
  active_creators: 0,
  registered_creators: 0,
  avg_latency_ms: 0,
  p95_latency_ms: 0,
  feed: [],
};

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconInbox = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);
const IconUserPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function formatUSDC(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({
  Icon,
  value,
  label,
  accent,
  bg,
  border,
  sub,
}: {
  Icon: () => React.ReactNode;
  value: string;
  label: string;
  accent: string;
  bg: string;
  border: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-5 flex flex-col gap-2`}>
      <div className={`flex items-center gap-2 ${accent}`}>
        <Icon />
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-3xl font-black text-gray-800 leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-500 font-medium">{sub}</div>}
    </div>
  );
}

// ── Latency bar ────────────────────────────────────────────────────────────
function LatencyBar({ avg, p95 }: { avg: number; p95: number }) {
  const ok = avg < 500;
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-3 ${ok ? "border-emerald-100 bg-emerald-50" : "border-amber-100 bg-amber-50"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ok ? "text-emerald-500 bg-emerald-100" : "text-amber-500 bg-amber-100"}`}>
        <IconZap />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${ok ? "text-emerald-700" : "text-amber-700"}`}>
          {ok ? "Sub-500ms SLA" : "Latency degraded"}
          {" · "}
          <span className="font-black">{avg.toFixed(0)}ms avg</span>
          {p95 > 0 && <span className="font-medium text-gray-500 ml-1">· P95 {p95.toFixed(0)}ms</span>}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">Payment confirmation latency — our key differentiator</div>
      </div>
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
        <IconCheck />
        {ok ? "FAST" : "SLOW"}
      </div>
    </div>
  );
}

// ── Feed item ──────────────────────────────────────────────────────────────
function FeedItem({ event, isNew }: { event: PaymentEvent; isNew: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${isNew ? "border-emerald-100 bg-emerald-50/60" : "border-pink-100 bg-white"}`}>
      <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
        <IconDollar />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-700 truncate">
          Agent paid{" "}
          <span className="text-emerald-600 font-black">${event.amount.toFixed(2)} USDC</span>
          {" to "}
          <span className="text-fuchsia-600 font-bold">{event.creator}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{event.tx.slice(0, 14)}…</span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-400">{event.latency_ms.toFixed(0)}ms</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(event.ts)}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function TractionPage() {
  const [snap, setSnap] = useState<TractionSnapshot>(EMPTY);
  const [feed, setFeed] = useState<PaymentEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // SSE connection — fallback to polling if browser blocks it
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/v1/traction/stats`);
          if (!res.ok) return;
          const data: TractionSnapshot = await res.json();
          setSnap(data);
          setFeed(data.feed ?? []);
        } catch {
          // silently ignore
        }
      }, 5000);
    }

    try {
      const es = new EventSource(`${API}/v1/traction/feed`);
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener("snapshot", (e) => {
        try {
          const data: TractionSnapshot = JSON.parse(e.data);
          setSnap(data);
          setFeed(data.feed ?? []);
        } catch {}
      });

      es.addEventListener("payment_settled", (e) => {
        try {
          const event: PaymentEvent = JSON.parse(e.data);
          setSnap((prev) => ({
            ...prev,
            total_usdc: prev.total_usdc + event.amount,
            total_payments: prev.total_payments + 1,
          }));
          setFeed((prev) => {
            const next = [event, ...prev].slice(0, 20);
            return next;
          });
          // Mark as new for 4s animation
          setNewIds((prev) => new Set(prev).add(event.intent_id));
          setTimeout(() => {
            setNewIds((prev) => {
              const s = new Set(prev);
              s.delete(event.intent_id);
              return s;
            });
          }, 4000);
        } catch {}
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      esRef.current?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-10 max-w-2xl">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent leading-tight">
                Traction Live
              </h1>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${connected ? "bg-emerald-400 animate-pulse" : "bg-gray-300"}`} />
            </div>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              Real USDC flowing to creators · RFB-06 · Arc Lepton
            </p>
          </div>

          {/* ── Stats grid ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard
              Icon={IconDollar}
              value={`$${formatUSDC(snap.total_usdc)}`}
              label="USDC Paid"
              accent="text-emerald-600"
              bg="bg-emerald-50"
              border="border-emerald-100"
              sub="Total in window"
            />
            <StatCard
              Icon={IconZap}
              value={String(snap.total_payments)}
              label="Payments"
              accent="text-violet-600"
              bg="bg-violet-50"
              border="border-violet-100"
              sub="Nanopayments"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard
              Icon={IconUsers}
              value={String(snap.active_creators)}
              label="Paid creators"
              accent="text-fuchsia-600"
              bg="bg-fuchsia-50"
              border="border-fuchsia-100"
              sub="Received USDC"
            />
            <StatCard
              Icon={IconUserPlus}
              value={String(snap.registered_creators)}
              label="Registered"
              accent="text-pink-600"
              bg="bg-pink-50"
              border="border-pink-100"
              sub="Eligible creators"
            />
          </div>

          {/* ── Latency bar ─────────────────────────────────────────── */}
          <div className="mb-4">
            <LatencyBar avg={snap.avg_latency_ms} p95={snap.p95_latency_ms} />
          </div>

          {/* ── Creator CTA ─────────────────────────────────────────── */}
          <Link
            href="/onboarding"
            className="flex items-center justify-between px-5 py-4 rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-pink-50 hover:from-fuchsia-100 hover:to-pink-100 transition-all duration-200 group mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-fuchsia-100 text-fuchsia-500 flex items-center justify-center shrink-0">
                <IconUserPlus />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">Are you a creator?</p>
                <p className="text-xs text-gray-500">Register once — receive USDC automatically</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-fuchsia-500 group-hover:translate-x-1 transition-transform">
              Join
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <path d="M5 12h14m-7-7 7 7-7 7"/>
              </svg>
            </div>
          </Link>

          {/* ── Live feed ───────────────────────────────────────────── */}
          <div className="rounded-2xl border border-pink-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100/60">
              <div className="flex items-center gap-2">
                <span className="text-fuchsia-400"><IconActivity /></span>
                <div>
                  <h2 className="text-sm font-bold text-gray-700">Live Payment Feed</h2>
                  <p className="text-xs text-gray-500">Agent → Creator · real-time</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${connected ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-gray-500 bg-gray-50 border border-gray-100"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-gray-400"}`} />
                {connected ? "SSE live" : "polling"}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-pink-200 mb-3"><IconInbox /></div>
                  <p className="text-xs font-semibold text-gray-500">Waiting for payments…</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs">
                    Once the agent starts paying creators, events will appear here in real time.
                  </p>
                </div>
              ) : (
                feed.map((ev) => (
                  <FeedItem
                    key={ev.intent_id}
                    event={ev}
                    isNew={newIds.has(ev.intent_id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <p className="text-center text-xs text-gray-400 font-medium uppercase tracking-widest mt-8">
            Arc Lepton · RFB-06 · XiaoLee Core
          </p>

        </main>
      </div>
    </ThemeProviderWrapper>
  );
}
