/**
 * ActivityFeed — Feed de atividade recente do usuário
 *
 * Exibe as últimas notificações (claims, swaps, eventos on-chain) em cards
 * com micro-animações e suporte a reconhecimento (ACK) inline.
 */
"use client";

import React from "react";
import { useNotifications, NotificationItem } from "@/hooks/useNotifications";

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconTrophy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"/><rect x="6" y="18" width="12" height="4"/>
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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
const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
function getEventMeta(notification: NotificationItem): {
  Icon: () => JSX.Element;
  accent: string;
  label: string;
} {
  const title = notification.title.toLowerCase();
  if (title.includes("claim"))    return { Icon: IconTrophy,  accent: "text-amber-500 bg-amber-50 border-amber-100",   label: "Reward" };
  if (title.includes("swap"))     return { Icon: IconRefresh, accent: "text-blue-500 bg-blue-50 border-blue-100",      label: "Swap" };
  if (title.includes("campaign")) return { Icon: IconTarget,  accent: "text-fuchsia-500 bg-fuchsia-50 border-fuchsia-100", label: "Campaign" };
  return                                 { Icon: IconBell,    accent: "text-gray-400 bg-gray-50 border-gray-100",      label: "Info" };
}

function timeAgo(isoDate?: string): string {
  if (!isoDate) return "";
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

interface ActivityFeedProps {
  maxItems?: number;
}

export default function ActivityFeed({ maxItems = 5 }: ActivityFeedProps) {
  const { notifications, loading, error, ackNotification, isAckLoading, refetch } = useNotifications();
  const recent = notifications.slice(0, maxItems);

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-pink-50 border border-pink-100" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
        <span className="text-orange-400 shrink-0"><IconAlert /></span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-orange-600">{error}</p>
        </div>
        <button
          onClick={refetch}
          className="text-xs text-orange-500 font-semibold underline hover:text-orange-700 transition-colors shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="text-pink-200 mb-3"><IconInbox /></div>
        <p className="text-xs font-semibold text-gray-500">Nenhuma atividade recente</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
          Participe de uma campanha ou faça um swap para ver seu histórico aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {recent.map((notif) => {
        const { Icon, accent, label } = getEventMeta(notif);
        const isPending = notif.status === "pending";

        return (
          <div
            key={notif.id}
            className={`
              relative rounded-xl border transition-colors duration-150
              hover:bg-pink-50/40
              ${isPending ? "border-pink-100 bg-white" : "border-emerald-100 bg-emerald-50/30"}
            `}
          >
            <div className="flex items-start gap-3 p-3">
              {/* Icon */}
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${accent}`}>
                <Icon />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${accent}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-300 shrink-0">
                    {timeAgo((notif as NotificationItem & { created_at?: string }).created_at)}
                  </span>
                </div>

                <p className="text-xs font-semibold text-gray-700 mt-1 truncate">{notif.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{notif.body}</p>

                {/* ACK button */}
                {isPending && (
                  <button
                    onClick={() => ackNotification(notif.id)}
                    disabled={isAckLoading(notif.id)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    <IconCheck />
                    {isAckLoading(notif.id) ? "Confirmando..." : "Confirmar"}
                  </button>
                )}

                {/* Receipt hash */}
                {notif.related_signature && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-gray-300"><IconReceipt /></span>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{notif.related_signature}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {notifications.length > maxItems && (
        <p className="text-center text-xs text-gray-400 pt-1">
          +{notifications.length - maxItems} notificações anteriores
        </p>
      )}
    </div>
  );
}
