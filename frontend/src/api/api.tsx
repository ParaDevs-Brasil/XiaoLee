import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_CORE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('API Error: no response received', error.message, error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface CreatorRegisterResult {
  ok: boolean;
  creator: string;
  circle_wallet_id: string;
  eligible: boolean;
  already_registered: boolean;
  registered_at: string;
  message: string;
}

export type CreatorChain = "arc" | "solana" | "stellar";

/**
 * Registra um creator com endereço nativo + chain (ROADMAP F0.1).
 * `circle_wallet_id` segue no payload por compatibilidade com o contrato
 * anterior; o backend novo lê `wallet_address` + `chain`.
 */
export async function registerCreator(
  twitterHandle: string,
  walletAddress: string,
  chain: CreatorChain,
): Promise<CreatorRegisterResult> {
  const res = await api.post<CreatorRegisterResult>("/v1/creator/register", {
    twitter_handle: twitterHandle,
    wallet_address: walletAddress,
    chain,
    circle_wallet_id: walletAddress,
  });
  return res.data;
}

export default api;
