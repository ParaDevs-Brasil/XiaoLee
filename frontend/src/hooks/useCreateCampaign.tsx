import { useState } from 'react';
import api from '@/api/api';
import { CreateCampaignRequest, CreateCampaignResponse } from '@/interfaces';
import UserData from '@/components/UserData';

interface UseCreateCampaignReturn {
  createCampaign: (campaignData: CreateCampaignRequest) => Promise<CreateCampaignResponse>;
  isCreating: boolean;
  error: string | null;
  success: boolean;
  reset: () => void;
}

export default function useCreateCampaign(): UseCreateCampaignReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createCampaign = async (campaignData: CreateCampaignRequest): Promise<CreateCampaignResponse> => {
    setIsCreating(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Verificar se há dados de usuário e session_id
      if (!UserData.hasData()) {
        throw new Error('Usuário não autenticado. Faça login para criar uma campanha.');
      }

      const sessionId = UserData.getSessionId();
      if (!sessionId) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      console.log('🚀 Criando campanha:', campaignData);

      const response = await api.post('/campaigns', campaignData, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Campanha criada com sucesso:', response.data);
      setSuccess(true);
      return response.data;

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erro ao criar campanha';
      console.error('❌ Erro ao criar campanha:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
  };

  return {
    createCampaign,
    isCreating,
    error,
    success,
    reset
  };
}
