import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/api';

export type AgentRunStatus = 'idle' | 'pending' | 'running' | 'completed' | 'max_steps' | 'budget_exhausted' | 'failed';

export interface AgentStep {
  step: number;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: Record<string, unknown>;
}

export interface AgentPayment {
  step: number;
  to: string;
  amount_usdc: number;
  tx: string;
  intent_id: string;
}

export interface AgentStatusData {
  agent_run_id: string;
  campaign_id: number;
  status: AgentRunStatus;
  steps_count: number;
  payments_count: number;
  total_paid_usdc: number;
  payments: AgentPayment[];
  steps: AgentStep[];
  final_message: string;
  error?: string | null;
}

interface UseAgentStatusReturn {
  runId: string | null;
  status: AgentRunStatus;
  data: AgentStatusData | null;
  isRunning: boolean;
  error: string | null;
  startAgent: (campaignId: number, budgetUsdc: number, rewardPerCreator?: number) => Promise<void>;
  reset: () => void;
}

const TERMINAL_STATUSES: AgentRunStatus[] = ['completed', 'max_steps', 'budget_exhausted', 'failed'];
const POLL_INTERVAL_MS = 2500;

export function useAgentStatus(): UseAgentStatusReturn {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentRunStatus>('idle');
  const [data, setData] = useState<AgentStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (id: string) => {
    try {
      const resp = await api.get<AgentStatusData>(`/v1/agent/run-campaign/${id}/status`);
      const d = resp.data;
      setData(d);
      setStatus(d.status);
      if (TERMINAL_STATUSES.includes(d.status)) {
        stopPolling();
        if (d.error) setError(d.error);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Erro ao consultar status do agente';
      setError(msg);
      stopPolling();
      setStatus('failed');
    }
  }, [stopPolling]);

  const startAgent = useCallback(async (
    campaignId: number,
    budgetUsdc: number,
    rewardPerCreator: number = 5.0,
  ) => {
    setError(null);
    setData(null);
    setRunId(null);
    setStatus('pending');
    stopPolling();

    try {
      const resp = await api.post<{ agent_run_id: string }>('/v1/agent/run-campaign', {
        campaign_id: campaignId,
        budget_usdc: budgetUsdc,
        reward_per_creator_usdc: rewardPerCreator,
      });
      const id = resp.data.agent_run_id;
      setRunId(id);

      // Start polling
      pollRef.current = setInterval(() => pollStatus(id), POLL_INTERVAL_MS);
      // First poll immediately
      await pollStatus(id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Erro ao iniciar agente';
      setError(msg);
      setStatus('failed');
    }
  }, [pollStatus, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setRunId(null);
    setStatus('idle');
    setData(null);
    setError(null);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const isRunning = status === 'pending' || status === 'running';

  return { runId, status, data, isRunning, error, startAgent, reset };
}
