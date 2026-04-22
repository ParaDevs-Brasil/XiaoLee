import { useState, useEffect } from 'react';
import api from '@/api/api';
import UserData from '@/components/UserData';
import { UserCampaignsResponse, UserCampaignParticipation } from '@/interfaces';

interface UseUserCampaignsReturn {
  campaigns: UserCampaignParticipation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useUserCampaigns = (): UseUserCampaignsReturn => {
  const [campaigns, setCampaigns] = useState<UserCampaignParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar se há dados de usuário
      if (!UserData.hasData()) {
        setError('Usuário não autenticado');
        setCampaigns([]);
        return;
      }

      const userInfo = UserData.getUserInfo();
      const sessionId = UserData.getSessionId();

      console.log('🔍 Buscando campanhas do usuário:', userInfo.twitter_user_id);

      const response = await api.get<UserCampaignsResponse>('/campaigns/user', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`
        }
      });

      console.log('📬 Campanhas do usuário recebidas:', response.data);

      if (response.data.success) {
        setCampaigns(response.data.campaigns);
      } else {
        setError('Falha ao buscar campanhas do usuário');
        setCampaigns([]);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar campanhas do usuário:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserCampaigns();
  }, []);

  return {
    campaigns,
    loading,
    error,
    refetch: fetchUserCampaigns
  };
};

export default useUserCampaigns;
