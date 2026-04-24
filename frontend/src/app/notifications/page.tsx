"use client";

import React from 'react';
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
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 bg-clip-text text-transparent mb-4">
              Notification Center
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Acompanhe receipts de campanhas, confirme notificações e mantenha o histórico de claims sincronizado com a sua sessão Devnet.
            </p>
          </div>

          <div className="max-w-5xl mx-auto mb-8 rounded-3xl border border-cyan-100 bg-white/70 dark:bg-black/30 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-700 font-semibold">Active Devnet Context</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Session: <span className="font-mono text-gray-800 dark:text-white break-all">{sessionId || 'not initialized'}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Wallet: <span className="font-mono text-gray-800 dark:text-white break-all">{walletPublicKey || 'Phantom not connected'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mb-8">
            <div className="rounded-3xl bg-white/70 dark:bg-black/30 border border-white/20 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold text-blue-600">{notifications.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Total receipts</div>
            </div>
            <div className="rounded-3xl bg-white/70 dark:bg-black/30 border border-white/20 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold text-emerald-600">{deliveredCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Delivered</div>
            </div>
            <div className="rounded-3xl bg-white/70 dark:bg-black/30 border border-white/20 backdrop-blur-md p-5 shadow-lg text-center">
              <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Pending</div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto bg-white/70 dark:bg-black/30 backdrop-blur-md rounded-3xl border border-white/20 shadow-xl p-6 md:p-8">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Receipts e alertas</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Claims de campanhas e notificações operacionais do projeto.</p>
              </div>
              <button
                onClick={refetch}
                className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
              >
                Refresh
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
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 dark:bg-black/20 p-10 text-center">
                <div className="text-4xl mb-3">🔔</div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">No notifications yet</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Quando um claim for concluído, o receipt vai aparecer aqui.</p>
              </div>
            )}

            {!loading && notifications.length > 0 && (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div key={notification.id} className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-800">{notification.title}</h3>
                          <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            {notification.status}
                          </span>
                        </div>
                        <p className="mt-2 text-gray-600 text-sm leading-relaxed">{notification.body}</p>

                        {notification.related_signature && (
                          <div className="mt-3 rounded-2xl bg-white/80 border border-blue-100 p-3">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Receipt</div>
                            <div className="text-sm font-mono text-blue-700 break-all">{notification.related_signature}</div>
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
                            className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          >
                            {isAckLoading(notification.id) ? 'Acknowledging...' : 'Mark delivered'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
                            Delivered
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