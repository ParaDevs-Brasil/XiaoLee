import sendChatMessage from "@/hooks/useChat";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Video from "./Video";
import UserData from "./UserData";
import handleAuth, { AuthStatus } from "@/hooks/useAuth";
import { signTransactionXdr, submitToHorizon } from "@/utils/stellar";
import { IconSend, IconChat, IconCheck } from "@/components/icons";
import { XiaoleeBubble } from "@/components/landing/primitives";

type SwapExecution = {
  chain?: string;
  swap_xdr?: string | null;
  network_passphrase?: string;
  swap_quote?: {
    from: string;
    to: string;
    source_amount: number;
    destination_amount: number;
  };
  [key: string]: unknown;
};

type MessageType = {
  sent: string;
  response: string;
  hasCode?: boolean;
  code?: string;
  execution?: SwapExecution;
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
  const [swapSigning, setSwapSigning] = useState<{[key: number]: boolean}>({});
  const [swapTxHash, setSwapTxHash] = useState<{[key: number]: string}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track whether user is near the bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 80;
  };

  // Only auto-scroll if already near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgs]);

  // Check initial authentication status and load existing chat history
  useEffect(() => {
    const checkInitialAuthStatus = () => {
      const userData = UserData.getUserData();
      if (userData?.user_info?.twitter_user_id) {
        setAuthStatus({ status: "active" });
      }
    };

    const loadExistingChatHistory = () => {
      const chatHistory = UserData.getChatHistory();
      if (chatHistory.length > 0) {
        const existingMessages: MessageType[] = chatHistory.map(chat => ({
          sent: chat.user_message.content,
          response: chat.assistant_response.content,
          hasCode: false,
          code: ""
        }));
        setMsgs(existingMessages);
      }
    };

    checkInitialAuthStatus();
    loadExistingChatHistory();

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

      if (authResult.status === "active") {
        await fetchData();
      }

    } catch (error) {
      console.error("Error verifying auth:", error);
      setAuthStatus({ status: "expired" });
    } finally {
      setAuthLoading(prev => ({ ...prev, [messageIndex]: false }));
    }
  };

  const handleSignSwap = async (messageIndex: number, xdr: string, networkPassphrase?: string) => {
    setSwapSigning(prev => ({ ...prev, [messageIndex]: true }));
    try {
      const signedXdr = await signTransactionXdr(xdr, networkPassphrase ?? "Test SDF Network ; September 2015");
      const hash = await submitToHorizon(signedXdr, "testnet");
      setSwapTxHash(prev => ({ ...prev, [messageIndex]: hash }));
      setMsgs(prev => {
        const updated = [...prev];
        updated[messageIndex] = { ...updated[messageIndex], execution: { ...updated[messageIndex].execution, swap_xdr: null } };
        return updated;
      });
    } catch (err) {
      alert(`Erro ao assinar swap: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSwapSigning(prev => ({ ...prev, [messageIndex]: false }));
    }
  };

  useEffect(() => {
    fetchData();

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
    isNearBottomRef.current = true; // always scroll on send

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
        const execution = response.execution as SwapExecution | undefined;
        setMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { sent: message, response: content, hasCode: messageHasCode, code: messageCode, execution };
          return updated;
        });
        UserData.addLocalChatMessage(message, content);
      }

      if (UserData.getUserData() !== null) {
        await fetchData();
      }

    } catch (error) {
      console.error("Error sending message:", error);
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
    <div className="w-full lg:col-span-2 h-full min-h-0 rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-pink-100/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-fuchsia-400"><IconChat size={16} /></span>
          <div>
            <h2 className="text-sm font-bold text-gray-700">Chat with Xiaolee</h2>
            <p className="text-xs text-gray-500 hidden md:block">Swaps, campaigns and payments — by message</p>
          </div>
        </div>
        {authStatus?.status === "active" && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
            <IconCheck size={10} sw={3} />
            Authenticated
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 md:px-5 py-4 space-y-4 custom-scrollbar min-h-0"
      >
        {messagesWithCodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <XiaoleeBubble size={64} />
            <p className="mt-4 text-sm font-semibold text-gray-700">
              Start a chat with Xiaolee
            </p>
            <p className="mt-1 text-xs text-gray-500 max-w-xs leading-relaxed">
              Ask for a swap, check a balance or join a campaign — she handles it all right here. (◕‿◕)♡
            </p>
          </div>
        )}

        {messagesWithCodes.map((msg, index) => (
          <div key={index} className="space-y-3">

            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[70%]">
                <div className="btn-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                  <p className="font-medium leading-relaxed break-words text-sm">
                    {msg.sent}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 text-right mt-1 pr-1">You</p>
              </div>
            </div>

            {/* Xiaolee Response */}
            <div className="flex justify-start items-end gap-2">
              <div className="hidden sm:block shrink-0 mb-5">
                <XiaoleeBubble size={28} />
              </div>
              <div className="max-w-[85%] md:max-w-[70%]">
                <div className="bg-white border border-pink-100 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                  {msg.response === TYPING_SENTINEL ? (
                    <div className="flex items-center gap-2 py-1 text-fuchsia-400">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  ) : (
                    <p className="text-gray-700 leading-relaxed break-words text-sm">
                      {msg.response}
                    </p>
                  )}

                  {/* Swap signing button — appears when AI returned a swap_xdr */}
                  {msg.execution?.swap_xdr && msg.response !== TYPING_SENTINEL && (
                    <div className="mt-3 space-y-2">
                      {msg.execution.swap_quote && (
                        <p className="text-xs text-sky-600 font-mono">
                          {msg.execution.swap_quote.source_amount} {msg.execution.swap_quote.from} → ~{msg.execution.swap_quote.destination_amount.toFixed(4)} {msg.execution.swap_quote.to}
                        </p>
                      )}
                      <button
                        onClick={() => handleSignSwap(index, msg.execution!.swap_xdr as string, msg.execution?.network_passphrase)}
                        disabled={swapSigning[index]}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-50 transition-all"
                      >
                        {swapSigning[index] ? "Signing…" : "Sign with Freighter"}
                      </button>
                    </div>
                  )}

                  {/* Tx hash after successful swap */}
                  {swapTxHash[index] && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs space-y-1">
                      <p className="font-bold text-emerald-700 flex items-center gap-1">
                        <IconCheck size={12} sw={3} />
                        Swap executed on Stellar Testnet
                      </p>
                      <p className="font-mono text-emerald-600 break-all">{swapTxHash[index]}</p>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${swapTxHash[index]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-blue-600 hover:underline font-semibold"
                      >
                        View on Stellar Expert ↗
                      </a>
                    </div>
                  )}

                  {/* Verify + DM buttons — only if THIS message has code AND user is not authenticated */}
                  {msg.hasCode && msg.code && authStatus?.status !== "active" && (
                    <div className="mt-3 flex items-center flex-wrap gap-2">
                      <button
                        onClick={() => {
                          if (msg.code) {
                            handleVerifyAuth(index, msg.code);
                          }
                        }}
                        disabled={authLoading[index] || false}
                        className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all duration-200 ${
                          authLoading[index]
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white hover:from-fuchsia-600 hover:to-purple-700"
                        }`}
                      >
                        {authLoading[index] ? "Verifying…" : "Verify"}
                      </button>

                      <button
                        onClick={() => window.open('https://x.com/XiaoLeeDefai', '_blank')}
                        className="px-3 py-1.5 text-xs font-bold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-100 hover:bg-fuchsia-100 rounded-xl transition-all duration-200"
                      >
                        DM @Xiaolee
                      </button>

                      {authStatus && (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                          authStatus.status === "expired"
                            ? "bg-red-50 text-red-600 border border-red-100"
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {authStatus.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Meta row: name + reactions */}
                <div className={`flex items-center justify-between mt-1 px-1 ${msg.response === TYPING_SENTINEL ? 'hidden' : ''}`}>
                  <span className="text-[10px] text-gray-400">Xiaolee</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => Video.setPfp("xiaolee_love.mp4")}
                      className="text-xs opacity-50 hover:opacity-100 transition-all hover:scale-110"
                      title="Love it!"
                    >
                      💕
                    </button>
                    <button
                      onClick={() => Video.setPfp("xiaolee_cheer.mov")}
                      className="text-xs opacity-50 hover:opacity-100 transition-all hover:scale-110"
                      title="Cool!"
                    >
                      👏
                    </button>
                    <button
                      onClick={() => Video.setPfp("xiaolee_giggle.mp4")}
                      className="text-xs opacity-50 hover:opacity-100 transition-all hover:scale-110"
                      title="Funny!"
                    >
                      😊
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex gap-2 px-3 md:px-5 py-3 md:py-4 border-t border-pink-100/60 shrink-0 bg-white/50">
        <input
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
          placeholder="Your message here… (づ｡◕‿‿◕｡)づ"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:border-fuchsia-300 disabled:opacity-60 transition"
          disabled={loading}
        />
        <button
          onClick={(e) => {
            e.preventDefault();
            if (message.trim() && !loading) {
              handleSendMessage(message);
            }
          }}
          disabled={!message.trim() || loading}
          className="btn-primary flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-white text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <IconSend size={16} />
          )}
          <span className="hidden md:inline">{loading ? "Sending…" : "Send"}</span>
        </button>
      </div>
    </div>
  );
}
