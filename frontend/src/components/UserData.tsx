import useUser from "@/hooks/useUser";
import { 
  TypeUserData, 
  UserInfo, 
  History, 
  DetailedDossier,
  ActivityItem, 
  SwapHistoryItem, 
  ChatHistoryItem,
  TransactionHistoryItem,
  TokenBalance,
  UserCampaignParticipation
} from "@/interfaces";


export default class UserData {
  private static user_info: UserInfo;
  private static balances: TokenBalance[] = [];
  private static campaigns: UserCampaignParticipation[] = [];
  private static history: History = { 
    chat_history: [], 
    swaps: [], 
    transactions: [] 
  };
  private static twitter_user_id: string = "";
  private static session_id: string = "";

  static getUserData(): TypeUserData {
    return {
      user_info: this.user_info,
      balances: this.balances,
      campaigns: this.campaigns,
      history: this.history,
      session_id: this.session_id,
    };
  }
  
  static getHistory(): History {
    return this.history;
  }
  
  // Get specific history sections
  static getChatHistory(): ChatHistoryItem[] {
    return this.history.chat_history || [];
  }
  
  static getSwapHistory(): SwapHistoryItem[] {
    return this.history.swaps || [];
  }
  
  static getTransactionHistory(): TransactionHistoryItem[] {
    return this.history.transactions || [];
  }
  
  // Get combined activity items from all history sources
  static getAllActivityItems(): ActivityItem[] {
    const items: ActivityItem[] = [];
    
    // Add transaction history converted to activity items
    items.push(...this.getTransactionHistory().map(tx => ({
      type: 'transaction' as const,
      description: `${tx.transaction_type}: ${tx.amount} ${tx.token_symbol}`,
      timestamp: tx.created_at,
      amount: tx.amount,
      token: tx.token_symbol,
      status: tx.status
    })));
    
    // Add swaps as activity items (handle new format)
    items.push(...this.getSwapHistory().map(swap => ({
      type: 'swap' as const,
      description: `${swap.transaction_type}: ${swap.amount} ${swap.token}`,
      timestamp: swap.timestamp,
      amount: swap.amount.toString(),
      token: swap.token,
      status: swap.status
    })));
    
    // Add chat history as activity items
    items.push(...this.getChatHistory().map(chat => ({
      type: 'dm' as const,
      description: `Chat: ${chat.user_message.content.slice(0, 50)}...`,
      timestamp: chat.user_message.timestamp
    })));
    
    // Sort by timestamp (most recent first)
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  static getUserInfo(): UserInfo {
    return this.user_info;
  }  
  
  static getBalances(): TokenBalance[] {
    return this.balances;
  }
  
  static getUserCampaigns(): UserCampaignParticipation[] {
    return this.campaigns;
  }
  
  static getSessionId(): string {
    return this.session_id;
  }
  
  static setSessionId(session_id: string): void {
    this.session_id = session_id;
    console.log("🔐 Session ID set:", session_id);
  }
  
  static setUserData(data: TypeUserData | DetailedDossier | any): void {    
    console.log("📊 Setting user data:", data);
    
    // Handle the actual backend response format (based on your JSON)
    if (data.user_info && data.balances && Array.isArray(data.balances) && data.history) {
      this.user_info = data.user_info;
      this.balances = data.balances;
      this.campaigns = data.campaigns || [];
      
      // Handle the backend history format
      this.history = { 
        chat_history: data.history.chat_history || [],
        swaps: data.history.swaps || [],
        transactions: data.history.transactions || []
      };
      
      // Store raw data for components that need it
      (this as any)._rawSwapData = data.history.swaps || [];
      (this as any)._rawChatHistory = data.history.chat_history || [];
      (this as any)._rawTransactionData = data.history.transactions || [];
      
    } else if ('balances' in data && Array.isArray(data.balances)) {
      // Backend DetailedDossier format (legacy)
      this.user_info = data.user_info;
      this.balances = data.balances;
      this.campaigns = data.campaigns || [];
      
      // Store raw data for components that need it
      (this as any)._rawSwapData = (data as DetailedDossier).history.swaps || [];
      (this as any)._rawChatHistory = (data as DetailedDossier).history.chat_history || [];
      (this as any)._rawTransactionData = (data as DetailedDossier).history.transactions || [];
      
      // Store the backend history structure directly
      this.history = { 
        chat_history: (data as DetailedDossier).history.chat_history || [],
        swaps: (data as DetailedDossier).history.swaps || [],
        transactions: (data as DetailedDossier).history.transactions || []
      };
    } else {
      // Frontend TypeUserData format (legacy)
      this.user_info = data.user_info;
      this.balances = data.balances;
      this.campaigns = data.campaigns || [];
      this.history = data.history;
    }
    
    // Set session_id if provided
    if ('session_id' in data && data.session_id) {
      this.session_id = data.session_id;
    }
    
    console.log("🔍 Processed user data:", {
      user_info: this.user_info,
      balances_count: this.balances.length,
      chat_history_count: this.history.chat_history.length,
      swaps_count: this.history.swaps.length,
      transactions_count: this.history.transactions.length
    });
    
    // Dispatch custom event when data is loaded (only on client side)
    console.log("🎉 User data loaded, dispatching event");
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('userDataLoaded', {
        detail: this.getUserData()
      });
      window.dispatchEvent(event);
    }
  }
  
  static async fetchData(): Promise<boolean> {
    try {
      // Guard: do not call API with an empty user ID
      if (!this.twitter_user_id || this.twitter_user_id.trim() === "") {
        console.log("⏭ fetchData skipped — no twitter_user_id set");
        return false;
      }
      const data = await useUser(this.twitter_user_id);
      console.log("📊 Data fetched successfully:", data);
      this.setUserData(data.dossier);
      return true;
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      return false;
    }
  }  
  
  static setTwitterUserId(twitter_user_id: string): void {
    this.twitter_user_id = twitter_user_id;
  }

  // Method to check if data is loaded
  static hasData(): boolean {
    return this.user_info && this.user_info.twitter_user_id !== undefined;
  }
  
  // Method to add a local chat message to history
  static addLocalChatMessage(userMessage: string, assistantResponse: string): void {
    const timestamp = new Date().toISOString();
    
    const newChatItem = {
      user_message: {
        content: userMessage,
        timestamp: timestamp
      },
      assistant_response: {
        content: assistantResponse,
        timestamp: new Date(Date.now() + 1000).toISOString() // Assistant response 1 second later
      }
    };
    
    // Add to chat history
    this.history.chat_history.push(newChatItem);
    
    console.log("💬 Local chat message added to history:", newChatItem);
  }

  // Method to clear all data (useful for logout)
  static clearData(): void {
    this.history = { 
      chat_history: [], 
      swaps: [], 
      transactions: [] 
    };
    this.user_info = {} as UserInfo;
    this.balances = [];
    this.campaigns = [];
    this.twitter_user_id = "";
    this.session_id = "";
    
    // Clear raw data
    (this as any)._rawSwapData = [];
    (this as any)._rawChatHistory = [];
    (this as any)._rawTransactionData = [];
    
    console.log("🧹 User data cleared");
  }
  
  static verifyCampaignParticipation(campaignId: number): boolean {
    // Check if the user is participating in the campaign
    return this.campaigns.some(campaign => campaign.id === campaignId);
  }

  // Method to update campaigns data from useUserCampaigns hook
  static updateCampaigns(campaigns: UserCampaignParticipation[]): void {
    this.campaigns = campaigns;
    console.log("📊 Campaigns updated:", campaigns);
  }
}
