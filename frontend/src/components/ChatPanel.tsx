import sendChatMessage from "@/hooks/useChat";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Video from "./Video";
import UserData from "./UserData";
import handleAuth, { AuthStatus } from "@/hooks/useAuth";

type MessageType = {
  sent: string;
  response: string;
  hasCode?: boolean;
  code?: string;
};
const actions = {
  Cheer: "xiaolee_cheer.mov",
  Giggle: "xiaolee_giggle.mp4",
  Kawaii: "xiaolee_kawaii.mov",
  Love: "xiaolee_love.mp4",
  Hello: "xiaolee_hello.mov",
  Surprise: "xiaolee_surprise.mov",
  Uncomfortable: "xiaolee_unconfortable.mov",
  Ouch: "xiaolee_ouch.mov",
  "Think Low": "xiaolee_thinklow.mov",
  Salute: "xiaolee_salute.mov",
};


export default function ChatPanel() {  
  const [message, setMessage] = useState("");
  const [msgs, setMsgs] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState<{[key: number]: boolean}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // Check initial authentication status and load existing chat history
  useEffect(() => {
    const checkInitialAuthStatus = () => {
      const userData = UserData.getUserData();
      if (userData?.user_info?.twitter_user_id) {
        // If we have user data, consider as authenticated
        setAuthStatus({ status: "active" });
      }
    };
    
    const loadExistingChatHistory = () => {
      const chatHistory = UserData.getChatHistory();
      if (chatHistory.length > 0) {
        // Convert chat history to message format for the UI
        // Each chat history item becomes one message pair (sent/response)
        const existingMessages: MessageType[] = chatHistory.map(chat => ({
          sent: chat.user_message.content,
          response: chat.assistant_response.content,
          hasCode: false,
          code: ""
        }));
        setMsgs(existingMessages);
        console.log("📜 Loaded existing chat history:", existingMessages);
      }
    };
    
    checkInitialAuthStatus();
    loadExistingChatHistory();
    
    // Listen for user data updates
    const handleUserDataLoaded = () => {
      loadExistingChatHistory();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('userDataLoaded', handleUserDataLoaded);
      return () => window.removeEventListener('userDataLoaded', handleUserDataLoaded);
    }
  }, []);
  
  async function fetchData() {
    if (UserData.getUserData() !== null) {
      await UserData.fetchData();
    }
  }
  
  
  const handleVerifyAuth = async (messageIndex: number, token: string) => {
    setAuthLoading(prev => ({ ...prev, [messageIndex]: true }));
    
    try {
      const authResult = await handleAuth(token);
      setAuthStatus(authResult);
      
      // If authentication was successful, update user data
      if (authResult.status === "active") {
        await fetchData();
      }
      
    } catch (error) {
      console.error("❌ Error verifying auth:", error);
      setAuthStatus({ status: "expired" });
    } finally {
      setAuthLoading(prev => ({ ...prev, [messageIndex]: false }));
    }
  };

  useEffect(() => {
    fetchData();
    
    // Also check authentication status when userData changes
    const userData = UserData.getUserData();
    if (userData?.user_info?.twitter_user_id && (!authStatus || authStatus.status !== "active")) {
      setAuthStatus({ status: "active" });
    }
  }, [msgs, authStatus]);

  const messagesWithCodes = useMemo(() => {
    return msgs.map(msg => ({
      ...msg
    }));
  }, [msgs]);

  const TYPING_SENTINEL = "__typing__";

  const handleSendMessage = async (message: string) => {
    setLoading(true);
    setMessage("");

    // Show user message + typing indicator immediately
    setMsgs(prev => [...prev, { sent: message, response: TYPING_SENTINEL, hasCode: false, code: "" }]);

    try {
      const response = await sendChatMessage(message);

      let messageHasCode = false;
      let messageCode = "";

      if (response.code !== null && response.code !== undefined) {
        messageCode = response.code;
        messageHasCode = true;
      }

      if (response.animations !== null && response.animations !== undefined) {
        Video.setPfp(actions[response.animations as keyof typeof actions]);
      }

      if (response && response.response[0].content) {
        const content = response.response[0].content;
        setMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { sent: message, response: content, hasCode: messageHasCode, code: messageCode };
          return updated;
        });
        UserData.addLocalChatMessage(message, content);
      }

      if (UserData.getUserData() !== null) {
        await fetchData();
      }

    } catch (error) {
      console.error("❌ Error sending message:", error);
      const errText = "Sorry, there was an error sending your message. Please try again.";
      setMsgs(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { sent: message, response: errText, hasCode: false, code: "" };
        return updated;
      });
      UserData.addLocalChatMessage(message, errText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:col-span-2 h-full p-1 md:p-4 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col bg-gradient-to-br from-[var(--panel-bg-start)] via-[var(--panel-bg-middle)] to-[var(--panel-bg-end)] border-2 border-[var(--panel-border)] backdrop-blur-sm relative overflow-hidden">
      {/* Floating decorative elements - hidden on mobile */}
      <div className="absolute top-4 right-4 text-2xl animate-bounce cursor-none hidden md:block">🌸</div>
      <div className="absolute top-8 left-8 text-xl cursor-none hidden md:block">✨</div>
      <div className="absolute top-1/2 left-2 text-sm delay-300 cursor-none hidden md:block">🌟</div>
      
      {/* Header kawaii */}
      <div className="mb-2 md:mb-6 text-center relative z-10">
      <div className="inline-block p-1.5 md:p-4 bg-gradient-to-r from-[var(--panel-header-bg-start)] to-[var(--panel-header-bg-end)] rounded-2xl border border-[var(--panel-header-border)] backdrop-blur-sm">
        <h2 className="text-base md:text-2xl font-bold bg-gradient-to-r from-[var(--panel-header-text-start)] via-[var(--panel-header-text-middle)] to-[var(--panel-header-text-end)] bg-clip-text text-transparent mb-1 md:mb-2">
            Chat with Xiaolee
          </h2>
          <div className="flex justify-center items-center space-x-3">
            {/* SSE Connection Status */}
            
          </div>
        </div>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-1 md:pr-2 custom-scrollbar relative z-10 mb-2 md:mb-4 pb-2">        {messagesWithCodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
            <div className="text-4xl md:text-6xl mb-2 md:mb-4 animate-gentle-bounce cursor-none">💫</div>
            <p className="text-[var(--text-accent)] text-base md:text-lg font-medium px-2">
              Start a chat with Xiaolee! She&apos;s gonna like it (◕‿◕)♡
            </p>
            <div className="flex space-x-2 mt-1 md:mt-2">
              <span className="animate-sparkle cursor-none">✨</span>
              <span className="animate-sparkle delay-100 cursor-none">🌸</span>
              <span className="animate-sparkle delay-200 cursor-none">💕</span>
            </div>
          </div>
        )}

        {messagesWithCodes.map((msg, index) => (
          <div key={index} className="space-y-2 md:space-y-3">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[75%] relative">
                <div className="bg-gradient-to-r from-[var(--chat-bubble-assistant-border-start)] via-[var(--chat-bubble-assistant-border-middle)] to-[var(--chat-bubble-assistant-border-end)] p-[2px] rounded-2xl shadow-lg">
                  <div className="bg-gradient-to-r from-[var(--chat-bubble-user-bg-start)] to-[var(--chat-bubble-user-bg-end)] p-2 md:p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-start space-x-2 md:space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 md:w-8 md:h-8  hidden sm:flex bg-gradient-to-r from-[var(--chat-bubble-user-border-start)] via-[var(--chat-bubble-user-border-middle)] to-[var(--chat-bubble-user-border-end)] rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                          U
                        </div>
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-[var(--chat-bubble-user-text)] font-medium leading-relaxed break-words text-sm md:text-base">
                          {msg.sent}
                        </p>
                        <div className="flex items-center justify-end mt-1 md:mt-2 space-x-1">
                          <span className="text-xs text-pink-400/70">You</span>
                          <span className="text-pink-400 hidden md:inline">💬</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Cute tail */}
                <div className="absolute -bottom-1 right-4 w-3 h-3 bg-gradient-to-br from-pink-400 to-purple-400 rotate-45 transform"></div>
              </div>
            </div>

            {/* Xiaolee Response */}
            <div className="flex justify-start">
              <div className="max-w-[85%] md:max-w-[75%] relative">
                <div className="bg-gradient-to-r  from-[var(--chat-bubble-user-border-start)] via-[var(--chat-bubble-user-border-middle)] to-[var(--chat-bubble-user-border-end)] p-[2px] rounded-2xl shadow-lg">
                  <div className="bg-gradient-to-r from-[var(--chat-bubble-assistant-bg-start)] to-[var(--chat-bubble-assistant-bg-end)] p-2 md:p-4 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-start space-x-2 md:space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 md:w-8 md:h-8 hidden sm:flex  bg-gradient-to-r from-[var(--chat-bubble-assistant-avatar-start)] via-[var(--chat-bubble-assistant-avatar-middle)] to-[var(--chat-bubble-assistant-avatar-end)] rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                        🌸
                        </div>
                      </div>                      <div className="flex-grow min-w-0">
                        {msg.response === TYPING_SENTINEL ? (
                          <div className="flex items-center space-x-2 py-1">
                            <div className="flex items-center space-x-1 text-[var(--chat-bubble-assistant-text)]">
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </div>
                            <span className="text-xs text-[var(--chat-bubble-assistant-text)] opacity-60 italic animate-pulse">
                              digitando... / typing...
                            </span>
                          </div>
                        ) : (
                        <p className="text-[var(--chat-bubble-assistant-text)] leading-relaxed break-words text-sm md:text-base">
                          {msg.response}
                        </p>
                        )}
                        {/* Verify Button with Status - Only if THIS message has code AND user is not authenticated */}
                        {msg.hasCode && msg.code && authStatus?.status !== "active" && (
                          <div className="mt-2 md:mt-3 flex items-center space-x-1 md:space-x-2 flex-wrap gap-1 md:gap-2">
                            <button
                              onClick={() => {
                                if (msg.code) {
                                  handleVerifyAuth(index, msg.code);
                                }
                              }}
                              disabled={authLoading[index] || false}
                              className={`px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm rounded-lg font-medium transition-all duration-200 flex items-center space-x-1 md:space-x-1.5 ${
                                authLoading[index]
                                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                  : "bg-gradient-to-r from-blue-400 to-purple-400 text-white hover:from-blue-500 hover:to-purple-500 transform hover:scale-105"
                              }`}
                            >
                              <span className="text-xs">{authLoading[index] ? "Verifying..." : "Verify"}</span>
                              <span className="text-xs">
                                {authLoading[index] ? "⏳" : "🔍"}
                              </span>
                            </button>

                            {/* Twitter redirect button */}
                            <button
                              onClick={() => window.open('https://x.com/XiaoLeeDefai', '_blank')}
                              className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 text-xs font-medium text-white bg-gradient-to-r from-pink-400 to-rose-400 hover:from-pink-500 hover:to-rose-500 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md"
                            >
                              <span className="mr-1 hidden md:inline">💬</span>
                              <span className="md:hidden">DM</span>
                              <span className="hidden md:inline">DM @Xiaolee</span>
                            </button>
                            
                            {/* Status Badge */}
                            {authStatus && (
                              <div className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 ${
                                authStatus.status === "expired"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-yellow-100 text-yellow-600"
                              }`}>
                                <span className="text-xs">
                                  {authStatus.status === "expired" ? "❌" : "⏳"}
                                </span>
                                <span className="capitalize text-xs">{authStatus.status}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Show only status if user is already authenticated and not typing */}
                        {authStatus?.status === "active" && msg.response !== TYPING_SENTINEL && (
                          <div className="mt-2 md:mt-3">
                            <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 bg-green-100 text-green-600 w-fit">
                              <span className="text-xs">✅</span>
                              <span className="text-xs">Authenticated</span>
                            </div>
                          </div>
                        )}
                        <div className={`flex items-center justify-between mt-2 md:mt-3 ${msg.response === TYPING_SENTINEL ? 'hidden' : ''}`}>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-[var(--chat-bubble-assistant-accent-light)] italic">
                            Xiaolee
                            </span>
                            <span className="text-[var(--chat-bubble-assistant-accent)] animate-gentle-bounce">
                              ✨
                            </span>
                          </div>
                          <div className="flex space-x-2 sm:space-x-1">
                            <button
                              onClick={() => Video.setPfp("xiaolee_love.mp4")}
                              className="text-[var(--chat-action-love)] hover:text-[var(--chat-action-love-hover)] transition-colors duration-200 transform hover:scale-110 text-sm md:text-base"
                              title="Love it!"
                            >
                              💕
                            </button>
                            <button
                              onClick={() => Video.setPfp("xiaolee_cheer.mov")}
                              className="text-[var(--chat-action-cheer)] hover:text-[var(--chat-action-cheer-hover)] transition-colors duration-200 transform hover:scale-110 text-sm md:text-base"
                              title="Cool!"
                            >
                              👏
                            </button>
                            <button
                              onClick={() => Video.setPfp("xiaolee_giggle.mp4")}
                              className="text-[var(--chat-action-giggle)] hover:text-[var(--chat-action-giggle-hover)] transition-colors duration-200 transform hover:scale-110 text-sm md:text-base"
                              title="Funny!"
                            >
                              😊
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Cute tail */}
                <div className="absolute -bottom-1 left-4 w-3 h-3 bg-gradient-to-br from-[var(--chat-bubble-assistant-tail-start)] to-[var(--chat-bubble-assistant-tail-end)] rotate-45 transform"></div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Message Input */}
      <div className="mt-auto flex space-x-2 md:space-x-3 relative z-10 flex-shrink-0">
        <div className="flex-grow relative">          <input
            type="text"
            inputMode="text"
            enterKeyHint="send"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={(e) => {
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter" && message.trim() && !loading) {
                e.preventDefault();
                handleSendMessage(message);
              }
            }}
            placeholder="Your message here... (づ｡◕‿‿◕｡)づ"
            className="w-full p-3 md:p-4 pr-10 md:pr-12 border-2 border-[var(--input-border)] rounded-2xl focus:outline-none focus:ring-4 focus:ring-[var(--input-focus-ring)] focus:border-[var(--input-focus-border)] text-[var(--input-text)] placeholder-[var(--input-placeholder-text)] bg-gradient-to-r from-[var(--input-bg)] to-[var(--input-bg)] backdrop-blur-sm shadow-lg transition-all duration-300 text-sm md:text-base"
            disabled={loading}
          />
          <div className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 text-[var(--input-icon)] hidden md:block">
          💬
          </div>
        </div>        <button          
          onClick={(e) => {
            e.preventDefault();
            if (message.trim() && !loading) {
              handleSendMessage(message);
            }
          }}
          disabled={!message.trim() || loading}
          className="px-4 md:px-8 py-3 md:py-4 bg-gradient-to-r from-[var(--btn-primary-bg-start)] via-[var(--btn-primary-bg-middle)] to-[var(--btn-primary-bg-end)] text-white rounded-2xl hover:from-[var(--btn-primary-hover-bg-start)] hover:via-[var(--btn-primary-hover-bg-middle)] hover:to-[var(--btn-primary-hover-bg-end)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--btn-primary-ring)] shadow-xl  border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95"
        >
          <div className="flex items-center space-x-1 md:space-x-2">
            <span className="font-semibold text-sm md:text-base">{loading ? "Sending..." : "Send"}</span>
            <span className="text-base md:text-lg">{loading ? "⏳" : "🚀"}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
