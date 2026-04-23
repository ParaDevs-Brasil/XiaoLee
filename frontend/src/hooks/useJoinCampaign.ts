import { useState } from 'react';
import api from '@/api/api';
import UserData from '@/components/UserData';

interface JoinCampaignResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface ClaimRewardResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface UseJoinCampaignReturn {
  joinCampaign: (campaignId: number) => Promise<JoinCampaignResponse>;
  claimReward: (campaignId: number) => Promise<ClaimRewardResponse>;
  loading: boolean;
  claimLoading: boolean;
  error: string | null;
  claimError: string | null;
}

export default function useJoinCampaign(): UseJoinCampaignReturn {
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const joinCampaign = async (campaignId: number): Promise<JoinCampaignResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      // Verificar se o usuário está autenticado
      if (!UserData.hasData()) {
        throw new Error('Você precisa estar autenticado para participar de campanhas');
      }

      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      console.log(`🚀 Tentando participar da campanha ${campaignId}...`);

      const response = await api.post(`/campaigns/join`, {
        campaign_identifier: campaignId.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Resposta do servidor:', response.data);

      if (response.data.success) {
        console.log(`🎉 Sucesso: ${response.data.message}`);
        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.error || 'Erro desconhecido ao participar da campanha');
      }

    } catch (error: unknown) {
      console.error('❌ Erro ao participar da campanha:', error);
      
      let errorMessage = 'Erro ao participar da campanha';
      
      const apiError = error as { response?: { data?: { error?: string } }; message?: string };
      if (apiError.response?.data?.error) {
        errorMessage = apiError.response.data.error;
      } else if (apiError.message) {
        errorMessage = apiError.message;
      }
      
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (campaignId: number): Promise<ClaimRewardResponse> => {
    setClaimLoading(true);
    setClaimError(null);
    
    try {
      // Verificar se o usuário está autenticado
      if (!UserData.hasData()) {
        throw new Error('Você precisa estar autenticado para coletar recompensas');
      }

      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      console.log(`🎁 Tentando coletar recompensa da campanha ${campaignId}...`);

      const response = await api.post(`/campaigns/claim`, {
        campaign_identifier: campaignId.toString()
      }, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Resposta do servidor:', response.data);

      if (response.data.success) {
        console.log(`🎉 Sucesso: ${response.data.message}`);
        return {
          success: true,
          message: response.data.message
        };
      } else {
        throw new Error(response.data.error || 'Erro desconhecido ao coletar recompensa');
      }

    } catch (error: unknown) {
      console.error('❌ Erro ao coletar recompensa:', error);
      
      let errorMessage = 'Erro ao coletar recompensa';
      
      const apiError = error as { response?: { data?: { error?: string } }; message?: string };
      if (apiError.response?.data?.error) {
        errorMessage = apiError.response.data.error;
      } else if (apiError.message) {
        errorMessage = apiError.message;
      }
      
      setClaimError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setClaimLoading(false);
    }
  };

  return {
    joinCampaign,
    claimReward,
    loading,
    claimLoading,
    error,
    claimError
  };
}
