import React, { useState } from "react";
import UserData from "../UserData";
import { ChatMessage, HistoricoProps } from "@/interfaces";
import { formatDate, formatTime } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";
import { getRoleColor, getRoleIcon, filterHistory, typeOptions } from "@/utils/historyHelpers";

const Historico: React.FC<HistoricoProps> = ({ shouldOpen = false, onClose }) => {
    const [selectedFilter, setSelectedFilter] = useState<string>("all");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);
    
    // Get chat history from raw data - this will update when refreshTrigger changes
    const rawChatHistory = UserData.getChatHistory();
    
    // Convert to ChatMessage format
    const history: ChatMessage[] = rawChatHistory.length > 0 
      ? rawChatHistory.flatMap(chat => [
          {
            content: chat.user_message.content,
            role: "user" as const,
            timestamp: chat.user_message.timestamp
          },
          {
            content: chat.assistant_response.content,
            role: "assistant" as const,
            timestamp: chat.assistant_response.timestamp
          }
        ]).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      : []; // Return empty array if no chat history
    
    console.log("abrindo historico", history);
    
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

    const handleRefresh = async () => {
      setIsRefreshing(true);
      try {
        await UserData.fetchData();
        // Force component re-render
        setRefreshTrigger(prev => prev + 1);
        return UserData.getChatHistory();
      } catch (error) {
        console.error("Error fetching chat history:", error);
        return [];
      } finally {
        setIsRefreshing(false);
      }
    };

    const formatTimestamp = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        return "Just now ✨";
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)} hours ago`;
      } else {
        return formatDate(timestamp) + " " + formatTime(timestamp);
      }
    };

    const filteredHistory = filterHistory(history, selectedFilter);
    return (
      <>
        {isOpen && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
              animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
            }`}
            onClick={closeModal}
          >
            <div
              className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-4xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
                animateIn
                  ? "scale-100 opacity-100 translate-y-0"
                  : "scale-95 opacity-0 translate-y-4"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 text-2xl animate-bounce">
                📖
              </div>
              <div className="absolute top-8 left-8 text-xl sparkle-animation">
                ✨
              </div>
              <div className="absolute top-1/2 left-2 text-sm float-animation delay-300">
                🌟
              </div>
              <div className="absolute bottom-4 right-8 text-lg gentle-bounce delay-500">
                ⏰
              </div>
              {/* Header */}
              <div className="relative p-6 border-b border-[var(--modal-header-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-[var(--modal-header-icon-start)] to-[var(--modal-header-icon-end)] rounded-xl">
                      <span className="text-2xl">📚</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                        Chat History
                      </h2>
                      <p className="text-[var(--modal-header-subtitle)] font-medium">
                        Your conversations with Xiaolee! (◕‿◕)♡
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
                        className="w-6 h-6 text-[var(--modal-close-button-icon)] group-hover:text-[var(--modal-close-button-icon-hover)]"
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

                {/* Filter Tabs */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {typeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFilter(option.value)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        selectedFilter === option.value
                          ? "bg-gradient-to-r from-[var(--modal-filter-active-bg-start)] to-[var(--modal-filter-active-bg-end)] text-[var(--modal-filter-active-text)] shadow-lg"
                          : "bg-[var(--modal-filter-bg)] text-[var(--modal-filter-text)] hover:bg-[var(--modal-filter-hover-bg)]"
                      }`}
                    >
                      <span>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>{" "}
              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {filteredHistory.length > 0 ? (
                  <div className="space-y-4">
                    {filteredHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`group p-4 rounded-2xl border transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] bg-gradient-to-r ${getRoleColor(message.role)}`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm">
                            <span className="text-2xl">
                              {getRoleIcon(message.role)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary-hover)]">
                                {message.role === "user" ? "You" : "Xiaolee"}
                              </h3>
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-[var(--modal-item-bg-user-start)] text-[var(--modal-item-bg-user-end)]">
                                {message.role}
                              </span>
                            </div>
                            <div className="bg-white/70 rounded-xl p-3 mb-2">
                              <p className="text-gray-700 leading-relaxed">
                                {message.content}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-8xl mb-6 animate-gentle-bounce">
                      🐣
                    </div>{" "}
                    <h3 className="text-2xl font-bold text-purple-400 mb-2">
                      No messages yet!
                    </h3>
                    <p className="text-purple-400/80 text-lg mb-4">
                      Start chatting with Xiaolee to see your conversation
                      history here! ✨
                    </p>
                    <div className="flex space-x-2">
                      <span className="animate-sparkle">💫</span>
                      <span className="animate-sparkle delay-100">🌸</span>
                      <span className="animate-sparkle delay-200">💕</span>
                    </div>
                  </div>
                )}
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

export default Historico;
