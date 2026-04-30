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

  const deliveredCount = notifications.filter((notification) => notification.status === 'delivered').length;
  const pendingCount = notifications.length - deliveredCount;

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent mb-4">
              🔔 Notification Center
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Acompanhe receipts de campanhas, confirme notificações e mantenha o histórico de claims sincronizado com a sua sessão Devnet.
            </p>
          </div>

          <div className="max-w-5xl mx-auto mb-8 rounded-3xl border border-pink-200/50 bg-white/70 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-fuchsia-600 font-semibold">Active Devnet Context</div>
                <div className="text-sm text-gray-600 mt-1">
                  Session: <span className="font-mono text-gray-800 break-all">{sessionId || 'not initialized'}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Wallet: <span className="font-mono text-gray-800 break-all">{walletPublicKey || 'Phantom not connected'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mb-8">
            <div className="rounded-3xl bg-white/70 border border-pink-100 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">{notifications.length}</div>
              <div className="text-sm text-gray-500 mt-1">Total receipts</div>
            </div>
            <div className="rounded-3xl bg-white/70 border border-pink-100 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold text-emerald-500">{deliveredCount}</div>
              <div className="text-sm text-gray-500 mt-1">Delivered</div>
            </div>
            <div className="rounded-3xl bg-white/70 border border-pink-100 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold text-amber-500">{pendingCount}</div>
              <div className="text-sm text-gray-500 mt-1">Pending</div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto bg-white/70 backdrop-blur-md rounded-3xl border border-pink-200/40 shadow-xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">Receipts e alertas</h2>
                <p className="text-sm text-gray-500">Claims de campanhas e notificações operacionais do projeto.</p>
              </div>
              <button
                onClick={refetch}
                className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 text-white font-semibold hover:from-pink-500 hover:to-purple-600 transition-all duration-200 shadow-md kawaii-button"
              >
                Refresh ✨
              </button>
            </div>

            {loading && (
              <div className="py-10 flex justify-center">
                <LoadingSpinner size="lg" text="Loading notifications..." />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 mb-4">
                {error}
              </div>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="rounded-3xl border-2 border-dashed border-pink-200/50 bg-white/40 p-12 text-center backdrop-blur-sm transition-all duration-300 hover:bg-white/60">
                <div className="text-6xl mb-6 animate-gentle-bounce">🔔</div>
                <h3 className="text-2xl font-bold text-gray-700 mb-3">No notifications yet</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-8">
                  Suas notificações de claims e alertas de campanhas aparecerão aqui assim que você começar a participar da economia XiaoLee.
                </p>
                <Link href="/campaigns" className="inline-flex items-center px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 text-white font-bold shadow-lg hover:shadow-pink-200/50 transition-all transform hover:scale-105 active:scale-95 kawaii-button">
                  Explorar Campanhas 🚀
                </Link>
              </div>
            )}

            {!loading && notifications.length > 0 && (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div key={notification.id} className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/60 p-5 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-800">{notification.title}</h3>
                          <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700">
                            {notification.status}
                          </span>
                        </div>
                        <p className="mt-2 text-gray-600 text-sm leading-relaxed">{notification.body}</p>

                        {notification.related_signature && (
                          <div className="mt-3 rounded-2xl bg-white/80 border border-pink-100 p-3">
                            <div className="text-xs uppercase tracking-wide text-fuchsia-500 mb-1">Receipt</div>
                            <div className="text-sm font-mono text-purple-700 break-all">{notification.related_signature}</div>
                          </div>
                        )}

                        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                          <div className="mt-3 text-xs text-gray-500 break-all">
                            Metadata: {JSON.stringify(notification.metadata)}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
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
                            className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-semibold hover:from-emerald-500 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all kawaii-button"
                          >
                            {isAckLoading(notification.id) ? 'Acknowledging...' : 'Mark delivered'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                            ✅ Delivered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ThemeProviderWrapper>
  );
}