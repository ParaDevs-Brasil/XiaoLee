import api from "@/api/api";
import UserData from "@/components/UserData";

export default async function sendChatMessage(
    msg: string
    
   
) {
    
    try {        

        const connectedWallet = typeof window !== "undefined" ? localStorage.getItem("connected_wallet") : null;
        // Prefer custodial/Web3Auth wallet over Phantom for authenticated users
        const walletAddress = UserData.getUserInfo()?.custodial_wallet_address || connectedWallet || undefined;

        if (!UserData.hasData()) {
            console.log("🔍 Enviando como usuário anônimo (sem dados no UserData)");
            const response = await api.post("/chat", {
                message: msg,
                ...(walletAddress && { wallet_address: walletAddress })
            });
            console.log("📬 Mensagem anônima enviada:", response.data);
            return response.data;
        } else {
            console.log("🔍 Enviando como usuário autenticado:", UserData.getSessionId());

            const response = await api.post("/chat", {
                message: msg,
                ...(walletAddress && { wallet_address: walletAddress })
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${UserData.getSessionId()}` // Usando o twitter_user_id como token de autenticação
                },
            });

            console.log("📬 Mensagem autenticada enviada:", response.data);
            return response.data;
        }
    } catch (error) {
        console.error("❌ Error in useChat:", error);
        throw error;
    }
}
