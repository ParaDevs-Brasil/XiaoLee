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

export async function registerCreator(
  twitterHandle: string,
  circleWalletId: string,
): Promise<CreatorRegisterResult> {
  const res = await api.post<CreatorRegisterResult>("/v1/creator/register", {
    twitter_handle: twitterHandle,
    circle_wallet_id: circleWalletId,
  });
  return res.data;
}

export default api;
