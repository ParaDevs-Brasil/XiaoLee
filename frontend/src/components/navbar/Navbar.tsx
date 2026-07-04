import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from 'react-toastify';
import { ChevronDownIcon, UserIcon, RocketLaunchIcon, BellIcon, ChartBarIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import Transacoes from "./Transacoes";
import Historico from "./Historico";
import Wallet from "./Wallet";
import EvmWallet from "./EvmWallet";
import { ThemeToggle } from "./ThemeToggle";
import { TypeUserData } from "@/interfaces";
import UserData from "../UserData";
import dynamic from "next/dynamic";
import TelegramLoginButton from "../TelegramLoginButton";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { clearWeb3AuthProvider } from "@/lib/web3authProvider";

const Web3AuthButton = dynamic(() => import("../Web3AuthButton"), { ssr: false });

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <>
      {/* Very narrow screens: single button showing the current language; tap switches */}
      <button
        onClick={() => setLang(lang === "en" ? "pt" : "en")}
        aria-label="Switch language"
        className="min-[400px]:hidden shrink-0 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-sm transition-all duration-200 active:scale-95"
      >
        {lang === "en" ? "EN" : "PT"}
      </button>

      <div className="hidden min-[400px]:flex items-center gap-0.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-0.5 shrink-0">
        {(["en", "pt"] as Language[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              lang === l
                ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            {l === "en" ? "EN" : "PT"}
          </button>
        ))}
      </div>
    </>
  );
}

export default function Navbar() {
  const { t } = useLanguage();
  const [userData, setUserData] = useState<TypeUserData | null>(null);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showTelegramLogin, setShowTelegramLogin] = useState(false);
  const [shouldOpenTransactions, setShouldOpenTransactions] = useState(false);
  const [shouldOpenHistory, setShouldOpenHistory] = useState(false);
  const [shouldOpenWallet, setShouldOpenWallet] = useState(false);
  const [shouldOpenEvmWallet, setShouldOpenEvmWallet] = useState(false);
  const pathname = usePathname();

  
  const handleTransactionClick = () => {
    console.log("🔍 Transaction button clicked");
    setShouldOpenTransactions(true);
    setIsDropdownOpen(false);
  };

  const handleHistoryClick = () => {
    console.log("🔍 History button clicked");
    setShouldOpenHistory(true);
    setIsDropdownOpen(false);
  };

  const handleWalletClick = () => {
    console.log("💰 Wallet button clicked");
    setShouldOpenWallet(true);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    // Verificar se estamos no lado do cliente
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target && !target.closest('[data-dropdown]')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);
 

  const handleLogout = () => {
    clearWeb3AuthProvider();
    UserData.clearData();
    UserData.getOrCreateDevnetSession();
    const freshData = UserData.getUserData();
    setUserData(freshData);
    setIsDropdownOpen(false);
    toast.success(t('navbar.logged_out'));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Try to restore full session (user_info + wallet) from localStorage first
    const restored = UserData.restoreSession();
    if (!restored) {
      // No saved session — create or load existing guest/wallet session
      UserData.getOrCreateDevnetSession();
    }

    const currentData = UserData.getUserData();
    if (currentData?.user_info?.twitter_user_id) {
      setUserData(currentData);
      setIsUserDataLoaded(true);
    }

    const handleUserDataLoaded = (event: Event) => {
      const customEvent = event as CustomEvent<TypeUserData>;
      setUserData(customEvent.detail);
      setIsUserDataLoaded(true);
    };

    window.addEventListener('userDataLoaded', handleUserDataLoaded);
    return () => window.removeEventListener('userDataLoaded', handleUserDataLoaded);
  }, []);

  return (
    <>
      <nav className="bg-gradient-to-r from-[var(--navbar-bg-start)] via-[var(--navbar-bg-middle)] to-[var(--navbar-bg-end)] backdrop-blur-sm border-b-2 border-[var(--navbar-border)] shadow-xl px-2 py-2.5 sm:p-3 md:p-4 sticky top-0 z-20 overflow-visible">
        <div className="container mx-auto flex justify-between items-center relative z-[10000] gap-1.5 sm:gap-2">
          <div className="flex items-center shrink-0">
            <Link href="/" className="text-base md:text-2xl font-bold bg-gradient-to-r from-[var(--navbar-text-gradient-start)] via-[var(--navbar-text-gradient-middle)] to-[var(--navbar-text-gradient-end)] bg-clip-text text-transparent hover:scale-105 transition-transform whitespace-nowrap">
              <span className="hidden sm:inline">XiaoleeChat ✨</span>
              <span className="sm:hidden">Xiaolee ✨</span>
            </Link>
          </div>
          
          <div className="flex items-center justify-end flex-1 gap-0.5 sm:gap-1 md:gap-3">
            {/* Navigation — quiet links with palette accents; Dashboard is the single primary CTA */}
            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-1.5">
              <Link
                href="/campaigns"
                className={`inline-flex items-center justify-center gap-x-0 sm:gap-x-1.5 rounded-lg md:rounded-xl px-0 sm:px-3 md:px-4 text-[11px] md:text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 active:scale-95 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-auto sm:h-10 md:h-11 ${
                  pathname === '/campaigns'
                    ? 'bg-[var(--input-bg)] text-fuchsia-600 shadow-e1'
                    : 'text-[var(--text-secondary)] hover:bg-white/40 hover:text-fuchsia-600'
                }`}
              >
                <RocketLaunchIcon className="w-4 h-4 md:w-[18px] md:h-[18px] stroke-2 shrink-0 text-fuchsia-500" />
                <span className="hidden lg:inline">{t('navbar.campaigns')}</span>
              </Link>

              <Link
                href="/traction"
                className={`inline-flex items-center justify-center gap-x-0 sm:gap-x-1.5 rounded-lg md:rounded-xl px-0 sm:px-3 md:px-4 text-[11px] md:text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 active:scale-95 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-auto sm:h-10 md:h-11 ${
                  pathname === '/traction'
                    ? 'bg-[var(--input-bg)] text-sky-600 shadow-e1'
                    : 'text-[var(--text-secondary)] hover:bg-white/40 hover:text-sky-600'
                }`}
              >
                <CurrencyDollarIcon className="w-4 h-4 md:w-[18px] md:h-[18px] stroke-2 shrink-0 text-sky-500" />
                <span className="hidden lg:inline">Traction</span>
              </Link>

              <Link
                href="/notifications"
                title={t('navbar.notifications')}
                aria-label={t('navbar.notifications')}
                className={`inline-flex items-center justify-center rounded-lg md:rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 active:scale-95 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:h-10 sm:w-10 md:h-11 md:w-11 ${
                  pathname === '/notifications'
                    ? 'bg-[var(--input-bg)] text-purple-600 shadow-e1'
                    : 'text-[var(--text-secondary)] hover:bg-white/40 hover:text-purple-600'
                }`}
              >
                <BellIcon className="w-4 h-4 md:w-5 md:h-5 stroke-2 shrink-0" />
              </Link>

              <Link
                href="/dashboard"
                className={`inline-flex items-center justify-center gap-x-0 sm:gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-xl btn-primary px-0 sm:px-3 md:px-5 text-[11px] md:text-sm font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 active:scale-95 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-auto sm:h-10 md:h-11 ${pathname === '/dashboard' ? 'ring-2 ring-white/70' : ''}`}
              >
                <ChartBarIcon className="w-4 h-4 md:w-[18px] md:h-[18px] stroke-2 shrink-0" />
                <span className="hidden sm:inline lg:hidden whitespace-nowrap">{t('navbar.dashboard').slice(0,4)}</span>
                <span className="hidden lg:inline">{t('navbar.dashboard')}</span>
              </Link>
            </div>

            {/* Show user dropdown only when data is loaded */}
            {isUserDataLoaded && userData ? (
              <div className="relative" data-dropdown>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center justify-center gap-x-0 sm:gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-xl bg-white/40 border border-white/50 px-0 sm:px-3 md:px-4 text-[11px] md:text-sm font-semibold text-[var(--text-primary)] hover:bg-white/60 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 backdrop-blur-sm active:scale-95 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 sm:w-auto sm:h-10 md:h-11"
                >
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-gradient-to-br from-pink-400 to-purple-500 text-white rounded-full flex items-center justify-center shrink-0">
                    <UserIcon className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />
                  </div>
                  <span className="hidden lg:inline">
                    {userData.session_id?.startsWith('devnet_guest_')
                      ? 'Guest'
                      : userData.user_info?.twitter_handle
                        ? `@${userData.user_info.twitter_handle.slice(0, 12)}`
                        : 'User'}
                  </span>
                  <ChevronDownIcon
                    className={`hidden sm:block h-3 w-3 md:h-4 md:w-4 shrink-0 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                    
                {/* Dropdown Menu */}
                {isDropdownOpen && (
                <div className="absolute z-50 right-0 mt-2 w-56 md:w-64 origin-top-right rounded-2xl bg-gradient-to-br from-[var(--navbar-bg-start)] via-[var(--navbar-bg-middle)] to-[var(--navbar-bg-end)] backdrop-blur-sm border-2 border-[var(--navbar-border)] shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in-0 zoom-in-95">                    
                    {/* User Info Section */}
                    <div className="px-4 py-3 border-b border-[var(--navbar-border)]/30 backdrop-blur-sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                          {userData.user_info?.twitter_handle?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-[var(--navbar-text-gradient-start)] text-sm">
                            @{userData.user_info?.twitter_handle || 'Usuario'}
                          </div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/80">
                            ID: {userData.user_info?.twitter_user_id?.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2 bg-gradient-to-b from-[var(--navbar-bg-middle)]/50 to-[var(--navbar-bg-end)]/50 backdrop-blur-sm">
                      <div
                        onClick={() => {
                          handleWalletClick();
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">Wallet</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">View token balance</div>
                        </div>
                      </div>

                      <div
                        onClick={() => {
                          handleTransactionClick();
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">Transactions</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">View swap history</div>
                        </div>
                      </div>
                      
                      <div
                        onClick={() => {
                          handleHistoryClick();
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">History</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">View conversations and activities</div>
                        </div>
                      </div>

                      {/* EVM Wallet */}
                      <div
                        onClick={() => {
                          setShouldOpenEvmWallet(true);
                          setIsDropdownOpen(false);
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center font-bold">
                          Ξ
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">EVM Wallet</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">Arc · Circle · USDC · x402</div>
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="border-t border-[var(--navbar-border)]/30 my-2"></div>

                      {/* Login options — shown for non-Telegram and non-Google sessions */}
                      {!userData.session_id?.startsWith('tg_session_') && !userData.session_id?.startsWith('google_session_') && (
                        <div className="px-4 py-3 flex flex-col gap-2">
                          {/* Telegram login */}
                          {showTelegramLogin ? (
                            <div className="flex flex-col items-center gap-2">
                              <p className="text-xs text-[var(--navbar-text-gradient-middle)]/80 text-center">
                                Authorize in Telegram to link your account
                              </p>
                              <TelegramLoginButton
                                onSuccess={() => {
                                  setShowTelegramLogin(false);
                                  setIsDropdownOpen(false);
                                  toast.success("Telegram account linked!");
                                }}
                                onError={() => toast.error("Telegram login failed")}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowTelegramLogin(true)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold shadow hover:from-blue-600 hover:to-cyan-600 transition-all"
                            >
                              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                              </svg>
                              Login com Telegram
                            </button>
                          )}

                          {/* Google / Web3Auth login */}
                          <Web3AuthButton
                            onSuccess={() => {
                              setIsDropdownOpen(false);
                              toast.success("Google account linked!");
                            }}
                            onError={() => toast.error("Google login failed")}
                          />
                        </div>
                      )}

                      {/* Separator before financial actions */}
                      <div className="border-t border-[var(--navbar-border)]/30 my-2"></div>

                      {/* Withdraw Button */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          handleWalletClick();
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">Withdraw</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">Withdraw funds to wallet</div>
                        </div>
                      </div>

                      {/* Deposit Button */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          handleWalletClick();
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">Deposit</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">Add funds to account</div>
                        </div>
                      </div>
                    </div>

                    {/* Logout — only for authenticated (non-guest) sessions */}
                    {userData.session_id && !userData.session_id.startsWith('devnet_guest_') && (
                      <>
                        <div className="border-t border-[var(--navbar-border)]/30 my-2" />
                        <div
                          onClick={handleLogout}
                          className="group flex w-full items-center px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50/30 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                        >
                          <div className="mr-3 bg-red-100 dark:bg-red-900/50 text-red-500 w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <div className="font-semibold">{t('navbar.logout')}</div>
                            <div className="text-xs text-red-400/70">{t('navbar.logout_sub')}</div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Footer with session info */}
                    <div className="px-4 py-2 border-t border-[var(--navbar-border)]/30 backdrop-blur-sm">
                      <div className="flex items-center justify-between text-xs text-[var(--navbar-text-gradient-middle)]/80">
                        <span>✨ Online</span>
                        {userData.session_id && (
                          <span>Session: {userData.session_id.slice(0, 6)}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <></>
            )}
            
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Floating emoji decorations - Hidden on mobile */}
        <div className="hidden md:block absolute top-2 left-20 text-lg animate-float cursor-none">🌸</div>
        <div className="hidden md:block absolute bottom-4 right-16 text-sm animate-sparkle delay-700 cursor-none">
          ✨
        </div>
      </nav>
      
     
        <>
          {shouldOpenTransactions ? (
            <Transacoes
              transactions={UserData.getTransactionHistory()}
              balance={userData?.balances}
              shouldOpen={shouldOpenTransactions}
              onClose={() => setShouldOpenTransactions(false)}
            />
          ): null }
        
          {shouldOpenHistory ?
            <Historico 
              shouldOpen={shouldOpenHistory}
              onClose={() => setShouldOpenHistory(false)}
            />
          : null}

          {shouldOpenWallet ?
            <Wallet
              balance={userData?.balances}
              shouldOpen={shouldOpenWallet}
              onClose={() => setShouldOpenWallet(false)}
            />
          : null}

          {shouldOpenEvmWallet ?
            <EvmWallet
              shouldOpen={shouldOpenEvmWallet}
              onClose={() => setShouldOpenEvmWallet(false)}
            />
          : null}
        </>
      
    </>
  );
}
