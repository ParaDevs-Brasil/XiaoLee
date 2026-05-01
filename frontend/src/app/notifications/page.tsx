"use client";

import React from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import Navbar from '../../components/navbar/Navbar';
import useNotifications from '@/hooks/useNotifications';
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import UserData from '@/components/UserData';

export default function NotificationsPage() {
  const { notifications, loading, error, refetch, ackNotification, isAckLoading } = useNotifications();
  const sessionId = UserData.getSessionId();
  const walletPublicKey = UserData.getDevnetWalletPublicKey();

  const deliveredCount = notifications.filter((n) => n.status === 'delivered').length;
  const pendingCount = notifications.length - deliveredCount;

  const truncate = (str: string, maxLen = 16) =>
    str ? `${str.slice(0, 6)}...${str.slice(-6)}` : '—';

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-10 max-w-2xl">

          {/* ── Header ── */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-fuchsia-500 shadow-lg shadow-pink-200 mb-4">
              <span className="text-2xl">🔔</span>
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent mb-2 leading-tight">
              Notification Center
            </h1>
            <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
              Receipts de campanhas e histórico de claims da sua sessão Devnet.
            </p>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total', value: notifications.length, color: 'from-pink-500 to-fuchsia-500', bg: 'from-pink-50 to-fuchsia-50', border: 'border-pink-100' },
              { label: 'Entregues', value: deliveredCount, color: 'text-emerald-500', solid: true, bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-100' },
              { label: 'Pendentes', value: pendingCount, color: 'text-amber-500', solid: true, bg: 'from-amber-50 to-orange-50', border: 'border-amber-100' },
            ].map(({ label, value, color, solid, bg, border }) => (
              <div
                key={label}
                className={`rounded-2xl bg-gradient-to-br ${bg} border ${border} p-4 text-center shadow-sm`}
              >
                <div className={`text-2xl font-black leading-none ${solid ? color : `bg-gradient-to-r ${color} bg-clip-text text-transparent`}`}>
                  {value}
                </div>
                <div className="text-xs text-gray-400 mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Session Context ── */}
          <div className="rounded-2xl border border-pink-100 bg-white/60 backdrop-blur-sm p-4 mb-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-400 mb-3">
              Devnet Context
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 shrink-0">Session</span>
                <span className="text-xs font-mono text-gray-600 bg-pink-50 border border-pink-100 rounded-lg px-2 py-1 truncate max-w-[200px]" title={sessionId || ''}>
                  {sessionId ? truncate(sessionId, 12) : <span className="text-gray-300 italic">not initialized</span>}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 shrink-0">Wallet</span>
                <span className="text-xs font-mono text-gray-600 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 truncate max-w-[200px]" title={walletPublicKey || ''}>
                  {walletPublicKey ? truncate(walletPublicKey, 12) : <span className="text-gray-300 italic">Phantom not connected</span>}
                </span>
              </div>
            </div>
          </div>

          {/* ── List Section ── */}
          <div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-lg overflow-hidden">
            {/* List Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100/60">
              <div>
                <h2 className="text-base font-bold text-gray-700">Receipts & Alertas</h2>
                <p className="text-xs text-gray-400">Claims e notificações operacionais</p>
              </div>
              <button
                onClick={refetch}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 text-white text-xs font-semibold shadow-md shadow-pink-200 hover:shadow-pink-300 hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <span>↺</span>
                Refresh
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="py-16 flex justify-center">
                <LoadingSpinner size="lg" text="Loading notifications..." />
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && notifications.length === 0 && (
              <div className="px-6 py-16 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-fuchsia-100 flex items-center justify-center mb-5 shadow-inner">
                  <span className="text-3xl">🔕</span>
                </div>
                <h3 className="text-base font-bold text-gray-600 mb-1">Nenhuma notificação ainda</h3>
                <p className="text-xs text-gray-400 max-w-xs mb-6 leading-relaxed">
                  Seus receipts de claims e alertas de campanhas vão aparecer aqui assim que você começar a participar da economia XiaoLee.
                </p>
                <Link
                  href="/campaigns"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 text-white text-sm font-bold shadow-md shadow-pink-200 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  Explorar Campanhas 🚀
                </Link>
              </div>
            )}

            {/* Notification List */}
            {!loading && notifications.length > 0 && (
              <div className="divide-y divide-pink-50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="px-5 py-4 hover:bg-pink-50/40 transition-colors duration-150"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        notification.status === 'delivered'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400 animate-pulse'
                      }`} />

                      <div className="flex-1 min-w-0">
                        {/* Title + badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-bold text-gray-800 leading-tight">
                            {notification.title}
                          </h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            notification.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            {notification.status}
                          </span>
                        </div>

                        {/* Body */}
                        <p className="text-xs text-gray-500 leading-relaxed mb-2">
                          {notification.body}
                        </p>

                        {/* Receipt signature */}
                        {notification.related_signature && (
                          <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 mb-2">
                            <div className="text-xs text-fuchsia-400 font-bold uppercase tracking-wider mb-0.5">Receipt</div>
                            <div className="text-xs font-mono text-purple-600 break-all">{notification.related_signature}</div>
                          </div>
                        )}

                        {/* Metadata */}
                        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 font-mono break-all">
                            {JSON.stringify(notification.metadata)}
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div className="shrink-0 mt-0.5">
                        {notification.status !== 'delivered' ? (
                          <button
                            onClick={async () => {
                              try {
                                await ackNotification(notification.id);
                                toast.success('✅ Notification acknowledged.');
                              } catch {
                                toast.error('❌ Failed to acknowledge notification.');
                              }
                            }}
                            disabled={isAckLoading(notification.id)}
                            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs font-bold shadow-sm hover:shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            {isAckLoading(notification.id) ? '...' : '✓ Ack'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-500 text-xs font-bold border border-emerald-100">
                            ✓ Done
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer note ── */}
          <p className="text-center text-xs text-gray-300 mt-6">
            XiaoLee ✨ · Devnet Session
          </p>

        </main>
      </div>
    </ThemeProviderWrapper>
  );
}