/**
 * ActivityFeed — Feed de atividade recente do usuário
 *
 * Exibe as últimas notificações (claims, swaps, eventos on-chain) em cards
 * com micro-animações e suporte a reconhecimento (ACK) inline.
 */
"use client";

import React from "react";
import { useNotifications, NotificationItem } from "@/hooks/useNotifications";

// Mapeia tipo de evento para emoji e cor
function getEventMeta(notification: NotificationItem): {
  icon: string;
  colorClass: string;
  label: string;
} {
  const title = notification.title.toLowerCase();
  if (title.includes("claim")) {
    return { icon: "🏆", colorClass: "from-yellow-400 to-orange-400", label: "Reward" };
  }
  if (title.includes("swap")) {
    return { icon: "🔄", colorClass: "from-blue-400 to-indigo-500", label: "Swap" };
  }
  if (title.includes("join") || title.includes("campaign")) {
    return { icon: "🎯", colorClass: "from-pink-400 to-purple-500", label: "Campaign" };
  }
  return { icon: "🔔", colorClass: "from-gray-400 to-slate-500", label: "Info" };
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
  const { notifications, loading, error, ackNotification, isAckLoading, refetch } =
    useNotifications();

  const recent = notifications.slice(0, maxItems);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/30" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-sm text-orange-700 text-center">
        ⚠️ {error}
        <button
          onClick={refetch}
          className="ml-2 underline text-orange-600 hover:text-orange-800 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
        <div className="text-4xl mb-3 animate-gentle-bounce">📭</div>
        <p className="text-sm text-[var(--text-secondary)]">
          Nenhuma atividade recente ainda.
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Participe de uma campanha ou faça um swap para ver seu histórico aqui!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {recent.map((notif) => {
        const { icon, colorClass, label } = getEventMeta(notif);
        const isPending = notif.status === "pending";

        return (
          <div
            key={notif.id}
            className={`
              relative overflow-hidden rounded-2xl border transition-all duration-300
              hover:scale-[1.01] hover:shadow-lg
              ${isPending
                ? "border-[var(--panel-border)] bg-white/50 backdrop-blur-sm"
                : "border-green-200/50 bg-green-50/50"
              }
            `}
          >
            {/* Barra colorida lateral */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colorClass}`}
            />

            <div className="flex items-start gap-3 p-3 pl-4">
              {/* Ícone */}
              <div
                className={`
                  flex-shrink-0 w-9 h-9 rounded-xl
                  bg-gradient-to-br ${colorClass}
                  flex items-center justify-center text-lg shadow-md
                `}
              >
                {icon}
              </div>

              {/* Conteúdo */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`
                      text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                      bg-gradient-to-r ${colorClass} text-white
                    `}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                    {timeAgo((notif as NotificationItem & { created_at?: string }).created_at)}
                  </span>
                </div>

                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 truncate">
                  {notif.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                  {notif.body}
                </p>

                {/* Botão ACK */}
                {isPending && (
                  <button
                    onClick={() => ackNotification(notif.id)}
                    disabled={isAckLoading(notif.id)}
                    className={`
                      mt-2 text-xs px-3 py-1 rounded-lg font-medium transition-all duration-200
                      bg-gradient-to-r from-green-400 to-emerald-500 text-white
                      hover:from-green-500 hover:to-emerald-600 hover:scale-105
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {isAckLoading(notif.id) ? "⏳ Confirmando..." : "✅ Confirmar"}
                  </button>
                )}

                {/* Receipt */}
                {notif.related_signature && (
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-mono truncate">
                    🧾 {notif.related_signature}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {notifications.length > maxItems && (
        <p className="text-center text-xs text-[var(--text-secondary)] mt-1">
          +{notifications.length - maxItems} notificações anteriores
        </p>
      )}
    </div>
  );
}
