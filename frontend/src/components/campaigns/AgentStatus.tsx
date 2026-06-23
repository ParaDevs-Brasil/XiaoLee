"use client";
import React, { useState } from 'react';
import { useAgentStatus, AgentRunStatus } from '@/hooks/useAgentStatus';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconBot = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);
const IconSpinner = () => (
  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconCoin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v8m-3-5h6"/>
  </svg>
);

// ── Status helpers ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<AgentRunStatus, string> = {
  idle: 'Parado',
  pending: 'Iniciando...',
  running: 'Executando',
  completed: 'Concluído',
  max_steps: 'Limite atingido',
  budget_exhausted: 'Budget esgotado',
  failed: 'Falha',
};

const STATUS_COLOR: Record<AgentRunStatus, string> = {
  idle: 'bg-gray-100 text-gray-500 border-gray-200',
  pending: 'bg-amber-50 text-amber-600 border-amber-200',
  running: 'bg-blue-50 text-blue-600 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  max_steps: 'bg-purple-50 text-purple-600 border-purple-200',
  budget_exhausted: 'bg-orange-50 text-orange-600 border-orange-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
};

const isTerminal = (s: AgentRunStatus) =>
  ['completed', 'max_steps', 'budget_exhausted', 'failed'].includes(s);

// ── Props ──────────────────────────────────────────────────────────────────
interface AgentStatusProps {
  campaignId: number;
  campaignBudget: number;
  rewardPerCreator?: number;
  isCreator?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AgentStatus({
  campaignId,
  campaignBudget,
  rewardPerCreator = 5.0,
  isCreator = false,
}: AgentStatusProps) {
  const { runId, status, data, isRunning, error, startAgent, reset } = useAgentStatus();
  const [expanded, setExpanded] = useState(false);

  if (!isCreator) return null;

  const handleStart = () => startAgent(campaignId, campaignBudget, rewardPerCreator);

  return (
    <div className="mt-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/40 p-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-fuchsia-500"><IconBot /></span>
          <span className="text-xs font-bold text-gray-700">Agente IA</span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLOR[status]}`}>
            {(status === 'pending' || status === 'running') && <IconSpinner />}
            {status === 'completed' && <IconCheck />}
            {status === 'failed' && <IconX />}
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {data && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] font-semibold text-fuchsia-500 hover:text-fuchsia-700 transition-colors"
            >
              {expanded ? 'Ocultar' : 'Detalhes'}
            </button>
          )}
          {status === 'idle' || isTerminal(status) ? (
            <button
              onClick={isTerminal(status) ? () => { reset(); } : handleStart}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-50 text-white text-[11px] font-bold transition-colors"
            >
              <IconBot />
              {status === 'idle' ? 'Executar Agente' : 'Executar Novamente'}
            </button>
          ) : isRunning ? (
            <span className="text-[10px] text-gray-400 font-medium">
              {data?.steps_count ?? 0} steps...
            </span>
          ) : null}
        </div>
      </div>

      {/* Running start button (when idle, before any run) */}
      {status === 'idle' && (
        <p className="text-[11px] text-gray-400 mt-2">
          O agente vai descobrir criadores inscritos, avaliar elegibilidade e pagar em USDC via Arc sandbox.
        </p>
      )}

      {/* Summary stats (after run started) */}
      {data && status !== 'idle' && (
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-fuchsia-100">
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <IconCoin />
            <span className="font-bold text-gray-700">{data.total_paid_usdc.toFixed(2)} USDC</span>
            <span>pagos</span>
          </div>
          <div className="text-[11px] text-gray-500">
            <span className="font-bold text-gray-700">{data.payments_count}</span> criadores
          </div>
          <div className="text-[11px] text-gray-500">
            <span className="font-bold text-gray-700">{data.steps_count}</span> steps
          </div>
          {runId && (
            <span className="ml-auto text-[9px] text-gray-300 font-mono truncate max-w-[80px]" title={runId}>
              {runId.slice(0, 8)}…
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-[11px] text-red-500 font-medium">{error}</p>
      )}

      {/* Final message */}
      {data?.final_message && isTerminal(status) && (
        <p className="mt-2 text-[11px] text-gray-500 italic line-clamp-3">{data.final_message}</p>
      )}

      {/* Expandable: steps + payments */}
      {expanded && data && (
        <div className="mt-3 pt-3 border-t border-fuchsia-100 space-y-3">

          {/* Payments */}
          {data.payments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Pagamentos</p>
              <div className="space-y-1">
                {data.payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <IconCheck />
                    <span className="font-mono text-gray-600 truncate max-w-[100px]">{p.to.slice(0, 10)}…</span>
                    <span className="font-bold text-emerald-700 ml-auto">{p.amount_usdc} USDC</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent steps */}
          {data.steps.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Últimos steps</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {data.steps.slice(-6).map((s) => (
                  <div key={s.step} className="flex items-start gap-2 text-[10px] text-gray-500">
                    <span className="shrink-0 font-bold text-fuchsia-400">#{s.step}</span>
                    <span className="font-mono text-gray-600">{s.tool_name}</span>
                    {'error' in s.tool_result && (
                      <span className="text-red-400 ml-auto truncate max-w-[100px]">{String(s.tool_result.error)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
