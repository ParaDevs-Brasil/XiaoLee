import { useCallback, useState } from 'react';
import api from '../api/api';
import UserData from '../components/UserData';
import { 
  JoinCampaignResponse,
  VerifyTasksResponse,
  ClaimRewardResponse
} from '../interfaces';

export const useCampaignActions = () => {
  const [joinLoadingStates, setJoinLoadingStates] = useState<Record<number, boolean>>({});
  const [verifyLoadingStates, setVerifyLoadingStates] = useState<Record<number, boolean>>({});
  const [claimLoadingStates, setClaimLoadingStates] = useState<Record<number, boolean>>({});

  const toBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  };

  const joinCampaign = useCallback(async (campaignId: number): Promise<JoinCampaignResponse> => {
    setJoinLoadingStates(prev => ({ ...prev, [campaignId]: true }));
    try {
      const sessionId = UserData.getOrCreateDevnetSession();
      if (!sessionId) {
        throw new Error('Nao foi possivel iniciar sessao Devnet');
      }
      
      const response = await api.post<JoinCampaignResponse>(`/campaigns/join`, {
        campaign_identifier: campaignId.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      
      return response.data;
    } catch (error: unknown) {
      console.error('Error joining campaign:', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      return {
        success: false,
        error: apiError.response?.data?.error || 'Erro ao participar da campanha'
      };
    } finally {
      setJoinLoadingStates(prev => ({ ...prev, [campaignId]: false }));
    }
  }, []);

  const verifyTasks = useCallback(async (campaignId: number): Promise<VerifyTasksResponse> => {
    setVerifyLoadingStates(prev => ({ ...prev, [campaignId]: true }));
    try {
      const sessionId = UserData.getOrCreateDevnetSession();
      if (!sessionId) {
        throw new Error('Nao foi possivel iniciar sessao Devnet');
      }
      
      const response = await api.post<VerifyTasksResponse>(`/campaigns/verify`, {
        campaign_identifier: campaignId.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      
      return response.data;
    } catch (error: unknown) {
      console.error('Error verifying tasks:', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      return {
        success: false,
        message: apiError.response?.data?.error || 'Erro ao verificar tarefas'
      };
    } finally {
      setVerifyLoadingStates(prev => ({ ...prev, [campaignId]: false }));
    }
  }, []);

  const claimReward = useCallback(async (campaignId: number): Promise<ClaimRewardResponse> => {
    setClaimLoadingStates(prev => ({ ...prev, [campaignId]: true }));
    try {
      const sessionId = UserData.getOrCreateDevnetSession();
      if (!sessionId) {
        throw new Error('Nao foi possivel iniciar sessao Devnet');
      }

      // Custodial wallet (Google/Telegram) takes priority over Phantom
      const custodialWallet = UserData.getUserInfo()?.custodial_wallet_address;
      const phantomWallet = UserData.getDevnetWalletPublicKey();
      const walletPublicKey = custodialWallet || phantomWallet;

      if (!walletPublicKey) {
        throw new Error('Nenhuma wallet encontrada. Faça login com Google, Telegram ou conecte a Phantom.');
      }

      const proofMessage = `XiaoLee Devnet claim|campaign:${campaignId}|session:${sessionId}|wallet:${walletPublicKey}|ts:${Date.now()}`;
      const proofPayload = {
        proof_message: proofMessage,
        proof_encoding: 'none',
        wallet_public_key: walletPublicKey,
        wallet_signature: undefined as string | undefined,
      };

      // Only attempt Phantom signing for non-custodial (Phantom) sessions
      if (!custodialWallet) {
        const provider = (window as Window & {
          solana?: {
            signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
          };
        }).solana;

        if (provider?.signMessage) {
          const encoded = new TextEncoder().encode(proofMessage);
          const signed = await provider.signMessage(encoded, 'utf8');
          proofPayload.proof_encoding = 'base64';
          proofPayload.wallet_signature = toBase64(signed.signature);
        } else {
          throw new Error('Conecte a Phantom para assinar o claim da campanha');
        }
      }
      // Custodial users: authenticated via Bearer session_id header — no Phantom needed

      const response = await api.post<ClaimRewardResponse>(`/campaigns/claim`, {
        campaign_identifier: campaignId.toString(),
        ...proofPayload
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      
      return response.data;
    } catch (error: unknown) {
      console.error('Error claiming reward:', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      const localError = error instanceof Error ? error.message : '';
      return {
        success: false,
        error: apiError.response?.data?.error || localError || 'Erro ao coletar recompensa'
      };
    } finally {
      setClaimLoadingStates(prev => ({ ...prev, [campaignId]: false }));
    }
  }, []);

  // Helper functions to get loading state for specific campaigns
  const isJoinLoading = (campaignId: number) => joinLoadingStates[campaignId] || false;
  const isVerifyLoading = (campaignId: number) => verifyLoadingStates[campaignId] || false;
  const isClaimLoading = (campaignId: number) => claimLoadingStates[campaignId] || false;

  return {
    joinCampaign,
    verifyTasks,
    claimReward,
    isJoinLoading,
    isVerifyLoading,
    isClaimLoading
  };
};
