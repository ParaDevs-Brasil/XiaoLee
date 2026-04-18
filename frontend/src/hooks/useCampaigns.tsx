import { useState, useEffect } from 'react';
import api from "../api/api"
import { Campaign, CampaignsResponse, CampaignError } from "../interfaces";

interface UseCampaignsState {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseCampaignsReturn {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCampaigns = (): UseCampaignsReturn => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🚀 Buscando campanhas...");
      
      const response = await api.get<CampaignsResponse>("/campaigns");
      
      console.log("📋 Campanhas recebidas:", response.data);
      
      if (response.data.success) {
        setCampaigns(response.data.campaigns);
      } else {
        const errorResponse = response.data as CampaignError;
        setError(errorResponse.message || "Erro ao buscar campanhas");
      }
    } catch (err: any) {
      console.error("❌ Erro ao buscar campanhas:", err);
      
      // Verificar se é um erro de resposta da API
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Erro desconhecido ao buscar campanhas");
      }
      
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async (): Promise<void> => {
    await fetchCampaigns();
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return {
    campaigns,
    loading,
    error,
    refetch
  };
};

export default useCampaigns;
