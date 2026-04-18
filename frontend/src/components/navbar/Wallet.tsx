import React, { useState } from "react";
import { WalletProps } from "@/interfaces";
import { formatCurrency } from "@/utils/formatters";
import { useModal } from "@/hooks/useModal";

const Wallet: React.FC<WalletProps> = ({ balance = [], shouldOpen = false, onClose }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isOpen, animateIn, closeModal } = useModal(shouldOpen, onClose);

  const getMyBalance = () => {
    // Calculate total balance from all tokens
    if (balance && Array.isArray(balance)) {
      return balance.reduce((total, token) => {
        return total + (token.valueUSD || 0);
      }, 0);
    }
    return 0;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Component will refresh automatically
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {/* Wallet Modal */}
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            animateIn ? "bg-black/30 backdrop-blur-sm" : "bg-black/0"
          }`}
          onClick={closeModal}
        >
          <div
            className={`bg-gradient-to-br from-[var(--modal-bg-start)] via-[var(--modal-bg-middle)] to-[var(--modal-bg-end)] rounded-3xl shadow-2xl border-2 border-[var(--modal-border)] max-w-5xl w-full max-h-[90vh] overflow-hidden transition-all duration-300 transform ${
              animateIn
                ? "scale-100 opacity-100 translate-y-0"
                : "scale-95 opacity-0 translate-y-4"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--modal-footer-border)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-[var(--modal-header-title-start)] via-[var(--modal-header-title-middle)] to-[var(--modal-header-title-end)] bg-clip-text text-transparent">
                    💰 My Wallet
                  </h2>
                  <p className="text-[var(--modal-header-subtitle)]">
                    Your crypto balance
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg
                      className={`w-5 h-5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`}
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
                    className="p-2 hover:bg-[var(--modal-close-button-bg-hover)] rounded-lg transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400"
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

              {/* Total Balance */}
              <div className="text-center bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-6">
                <p className="text-sm text-[var(--modal-header-subtitle)] mb-2">
                  Total Balance
                </p>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                  {formatCurrency(getMyBalance())}
                </p>
              </div>
            </div>

            {/* Token List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {balance && Array.isArray(balance) && balance.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-[var(--modal-section-title)] mb-4 flex items-center">
                    💎 Your Tokens ({balance.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {balance.map((tokenData, index) => (
                      <div
                        key={tokenData.token}
                        className="bg-gradient-to-r from-[var(--token-card-bg-start)] to-[var(--token-card-bg-end)] rounded-xl p-4 border border-[var(--token-card-border)] hover:border-[var(--token-card-border-hover)] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-[var(--token-icon-bg-start)] to-[var(--token-icon-bg-end)] rounded-lg flex items-center justify-center text-lg">
                              💰
                            </div>
                            <div>
                              <h4 className="font-semibold text-[var(--token-card-title)]">
                                {tokenData.token}
                              </h4>
                              <p className="text-sm text-[var(--token-balance-label)]">
                                {tokenData.balance.toLocaleString()} tokens
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-semibold text-[var(--token-value-amount)]">
                              ${tokenData.valueUSD.toFixed(2)}
                            </p>
                            <p className="text-sm text-[var(--token-info-label)]">
                              ${tokenData.priceUSD.toFixed(4)} each
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🐣</div>
                  <h3 className="text-xl font-semibold text-[var(--modal-section-title)] mb-2">
                    No tokens yet!
                  </h3>
                  <p className="text-[var(--modal-header-subtitle)]">
                    Start earning tokens through campaigns
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--modal-footer-border)] bg-gradient-to-r from-[var(--modal-footer-bg-start)] to-[var(--modal-footer-bg-end)]">
              <div className="text-center text-sm text-[var(--modal-footer-text)]">
                Secured by Xiaolee 🌸
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Wallet;
