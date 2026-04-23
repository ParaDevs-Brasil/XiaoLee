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

  const joinCampaign = useCallback(async (campaignId: number): Promise<JoinCampaignResponse> => {
    setJoinLoadingStates(prev => ({ ...prev, [campaignId]: true }));
    try {
      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Usuário não autenticado');
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
      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Usuário não autenticado');
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
      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Usuário não autenticado');
      }
      
      const response = await api.post<ClaimRewardResponse>(`/campaigns/claim`, {
        campaign_identifier: campaignId.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
      
      return response.data;
    } catch (error: unknown) {
      console.error('Error claiming reward:', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      return {
        success: false,
        error: apiError.response?.data?.error || 'Erro ao coletar recompensa'
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
