import api from "@/api/api";
import UserData from "@/components/UserData";

export default async function sendChatMessage(
    msg: string
    
   
) {
    
    try {        

        const connectedWallet = typeof window !== "undefined" ? localStorage.getItem("connected_wallet") : null;
        if (!UserData.hasData()) {
            console.log("🔍 Enviando como usuário anônimo (sem dados no UserData)");
            const response = await api.post("/chat", {
                message: msg,
                ...(connectedWallet && { wallet_address: connectedWallet })
            });
            console.log("📬 Mensagem anônima enviada:", response.data);
            return response.data;
        } else {
            // Se há dados de usuário, pegar o twitter_user_id e enviar
            console.log("🔍 Enviando como usuário autenticado:", UserData.getSessionId());

            const response = await api.post("/chat", {
                message: msg,
                ...(connectedWallet && { wallet_address: connectedWallet })
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
