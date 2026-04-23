import React, { useState } from "react";
import { TransacoesProps, SwapHistoryItem, TransactionHistoryItem } from "@/interfaces";
import { formatDate } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";
import UserData from "@/components/UserData";

// Combined activity interface for display
interface DisplayActivity {
  type: 'swap' | 'transaction';
  id: string; // Changed to string to handle swap IDs
  description: string;
  timestamp: string;
  status: string;
  data: SwapHistoryItem | TransactionHistoryItem;
}

type ActivityTab = 'all' | 'swaps' | 'transactions';

const Transacoes: React.FC<TransacoesProps> = ({ transactions = [], shouldOpen = false, onClose }) => {
    const [activeTab, setActiveTab] = useState<ActivityTab>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [, setRefreshTrigger] = useState(0);
    const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

    // Get data from UserData; the setter below forces rerenders when data changes
    const history = UserData.getHistory();
    const swaps = history.swaps || [];
    const internalTransactions = history.transactions || [];
    
    // Listen for user data updates
    React.useEffect(() => {
      const handleUserDataLoaded = () => {
        setRefreshTrigger(prev => prev + 1);
      };
      
      if (typeof window !== 'undefined') {
        window.addEventListener('userDataLoaded', handleUserDataLoaded);
        return () => window.removeEventListener('userDataLoaded', handleUserDataLoaded);
      }
    }, []);
    
    // Function to get internal transactions from history
    const getInternalTransactions = (): TransactionHistoryItem[] => {
      // Get raw transaction data from UserData
      const rawTransactions = UserData.getTransactionHistory() as TransactionHistoryItem[];
      
      // If we have specific transaction data, use it
      if (rawTransactions && rawTransactions.length > 0) {
        return rawTransactions;
      }
      
      // Otherwise, return the transactions from history
      return internalTransactions;
    };
    
    // Combine all activities
    const getAllActivities = (): DisplayActivity[] => {
      const activities: DisplayActivity[] = [];
      
      // Add swaps (handle new format)
      swaps.forEach((swap: SwapHistoryItem, index: number) => {
        activities.push({
          type: 'swap',
          id: `swap-${index}`, // Generate ID since swap doesn't have one
          description: `${swap.transaction_type}: ${swap.amount} ${swap.token}`,
          timestamp: swap.timestamp,
          status: swap.status,
          data: swap
        });
      });
      
      // Add transactions from props (legacy support)
      transactions.forEach((tx: TransactionHistoryItem) => {
        activities.push({
          type: 'transaction',
          id: tx.id.toString(),
          description: `${tx.transaction_type}: ${tx.amount} ${tx.token_symbol}`,
          timestamp: tx.created_at,
          status: tx.status,
          data: tx
        });
      });
      
      // Add internal transactions
      const internalTx = getInternalTransactions();
      internalTx.forEach((tx: TransactionHistoryItem) => {
        if (tx.amount && tx.token_symbol) {
          activities.push({
            type: 'transaction',
            id: tx.id.toString(),
            description: `${tx.transaction_type}: ${tx.amount} ${tx.token_symbol}`,
            timestamp: tx.created_at,
            status: tx.status,
            data: tx
          });
        }
      });
      
      // Sort by timestamp (most recent first)
      return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    const getFilteredActivities = () => {
      const allActivities = getAllActivities();
      switch (activeTab) {
        case 'swaps':
          return allActivities.filter(activity => activity.type === 'swap');
        case 'transactions':
          return allActivities.filter(activity => activity.type === 'transaction');
        default:
          return allActivities;
      }
    };

    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        await UserData.fetchData();
        // Force component re-render
        setRefreshTrigger(prev => prev + 1);
      } catch (error) {
        console.error("Error refreshing transaction data:", error);
      } finally {
        setIsRefreshing(false);
      }
    };

    return (
      <>
        {/* Transaction Modal */}
        {isOpen && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
              animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
            }`}
            onClick={closeModal}
          >
            <div
              className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-5xl w-full max-h-[125vh] overflow-hidden transition-all duration-300 transform ${
                animateIn
                  ? "scale-100 opacity-100 translate-y-0"
                  : "scale-95 opacity-0 translate-y-4"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Floating decorative elements */}
              <div className="absolute top-4 right-4 text-2xl animate-bounce">
                💸
              </div>
              <div className="absolute top-8 left-8 text-xl sparkle-animation">
                ✨
              </div>
              <div className="absolute top-1/2 left-2 text-sm float-animation delay-300">
                🌟
              </div>
              <div className="absolute bottom-4 right-8 text-lg gentle-bounce delay-500">
                💎
              </div>

              {/* Header */}
              <div className="relative p-6 border-b border-[var(--modal-footer-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-[var(--modal-header-icon-start)] to-[var(--modal-header-icon-end)] rounded-xl">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                        Transaction History
                      </h2>
                      <p className="text-pink-400/80 font-medium">
                        Your financial journey with Xiaolee! (◕‿◕)♡
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="group p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-xl transition-all duration-200 hover:scale-110 disabled:opacity-50"
                    >
                      <svg
                        className={`w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-all duration-200 ${
                          isRefreshing ? 'animate-spin' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={closeModal}
                      className="group p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-xl transition-all duration-200 hover:scale-110"
                    >
                      <svg
                        className="w-6 h-6 text-pink-400 group-hover:text-pink-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 py-2 border-b border-[var(--modal-footer-border)]">
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { key: 'all', label: 'All', icon: '💫' },
                    { key: 'swaps', label: 'Swaps', icon: '🔄' },
                    { key: 'transactions', label: 'Transactions', icon: '💸' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as ActivityTab)}
                      className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                        activeTab === tab.key
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-600 hover:text-purple-600'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-hiddden">
                {(() => {
                  const filteredActivities = getFilteredActivities();
                  
                  if (filteredActivities.length > 0) {
                    return (
                      <div className="space-y-3 pr-2">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                            {activeTab === 'swaps' ? 'Swap History' : activeTab === 'transactions' ? 'Transaction History' : 'All Activity'}
                          </h3>
                          <span className="text-sm text-[var(--text-secondary)] bg-gray-100 px-3 py-1 rounded-full">
                            {filteredActivities.length} {filteredActivities.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <div className="max-h-[55vh] overflow-x-hidden overflow-y-auto pr-2 space-y-3">
                          {filteredActivities.map((activity) => (
                            <div
                              key={`${activity.type}-${activity.id}`}
                              className={`group max-h-[100px] p-4 rounded-2xl border transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] ${
                                activity.status === "completed"
                                  ? 'bg-gradient-to-r from-[var(--transaction-item-completed-bg-start)] to-[var(--transaction-item-completed-bg-end)] border-[var(--transaction-item-completed-border)]' 
                                  : 'bg-gradient-to-r from-[var(--transaction-item-pending-bg-start)] to-[var(--transaction-item-pending-bg-end)] border-[var(--transaction-item-pending-border)]'
                              }`}
                            >
                              <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">
                                    {activity.type === 'swap' ? '🔄' : '💸'}
                                  </span>
                                  <h3 className="font-semibold text-[var(--text-primary)] flex-1 truncate">
                                    {activity.type === 'swap' ? (
                                      (() => {
                                        const swapData = activity.data as SwapHistoryItem;
                                        return `${swapData.transaction_type}: ${swapData.amount} ${swapData.token}`;
                                      })()
                                    ) : (
                                      (() => {
                                        const txData = activity.data as TransactionHistoryItem;
                                        return `${txData.transaction_type}: ${txData.amount} ${txData.token_symbol}`;
                                      })()
                                    )}
                                  </h3>
                                  <p className="text-sm text-[var(--text-secondary)]">
                                  {formatDate(activity.timestamp)} • ID: {activity.id}
                                </p>
                                
                                </div>
                                
                                
                                {activity.type === 'swap' && (
                                  (() => {
                                    const swapData = activity.data as SwapHistoryItem;
                                    return swapData.to_address && (
                                      <p className="text-xs text-[var(--text-secondary)]">
                                        To Address: {swapData.to_address}
                                      </p>
                                    );
                                  })()
                                )}
                                
                                {activity.type === 'transaction' && (
                                  (() => {
                                    const txData = activity.data as TransactionHistoryItem;
                                    return txData.sender_twitter_handle && (
                                      <p className="text-xs text-[var(--text-secondary)]">
                                        From: @{txData.sender_twitter_handle} → @{txData.recipient_twitter_handle}
                                      </p>
                                    );
                                  })()
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      activity.status === "completed" 
                                        ? "text-green-600 bg-green-100" 
                                        : "text-yellow-600 bg-yellow-100"
                                    }`}
                                  >
                                    {activity.status}
                                  </span>
                                  
                                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                    {activity.type === 'swap' ? 'Swap' : 'Transaction'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="text-8xl mb-6 animate-gentle-bounce">
                          {activeTab === 'swaps' ? '🔄' : activeTab === 'transactions' ? '💸' : '🐣'}
                        </div>
                        <h3 className="text-2xl font-bold text-[var(--transaction-summary-text)] mb-2">
                          {activeTab === 'swaps' 
                            ? 'No swaps yet!' 
                            : activeTab === 'transactions' 
                            ? 'No transactions yet!'
                            : 'No activity yet!'
                          }
                        </h3>
                        <p className="text-[var(--transaction-summary-text)]/80 text-lg mb-4">
                          Your financial journey with Xiaolee is just beginning! ✨
                        </p>
                        <div className="flex space-x-2">
                          <span className="animate-sparkle">💫</span>
                          <span className="animate-sparkle delay-100">🌸</span>
                          <span className="animate-sparkle delay-200">💕</span>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--modal-footer-border)] bg-gradient-to-r from-[var(--modal-footer-bg-start)] to-[var(--modal-footer-bg-end)]">
                <div className="flex items-center justify-center space-x-2 text-[var(--modal-footer-text)] text-sm">
                  <span>Secured</span>
                  <span>by Xiaolee</span>
                  <span className="animate-bounce">🌸</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
};


export default Transacoes;
