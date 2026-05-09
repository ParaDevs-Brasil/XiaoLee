import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from 'react-toastify';
import { ChevronDownIcon, UserIcon, RocketLaunchIcon, BellIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import Transacoes from "./Transacoes";
import Historico from "./Historico";
import Wallet from "./Wallet";
import { ThemeToggle } from "./ThemeToggle";
import { TypeUserData } from "@/interfaces";
import UserData from "../UserData";
import { useLanguage, Language } from "@/contexts/LanguageContext";

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-0.5">
      {(["en", "pt"] as Language[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            lang === l
              ? "bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white shadow-sm"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          {l === "en" ? "EN" : "PT"}
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const { t } = useLanguage();
  const [userData, setUserData] = useState<TypeUserData | null>(null);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [shouldOpenTransactions, setShouldOpenTransactions] = useState(false);
  const [shouldOpenHistory, setShouldOpenHistory] = useState(false);
  const [shouldOpenWallet, setShouldOpenWallet] = useState(false);
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
 

   useEffect(() => {
    if (typeof window === 'undefined') return;

    // If there's already a session (devnet guest or wallet), show the button immediately.
    const existingSession = UserData.getSessionId();
    if (!existingSession) {
      // Create a guest session so the button always appears.
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
      <nav className="bg-gradient-to-r from-[var(--navbar-bg-start)] via-[var(--navbar-bg-middle)] to-[var(--navbar-bg-end)] backdrop-blur-sm border-b-2 border-[var(--navbar-border)] shadow-xl p-3 md:p-4 sticky top-0 z-20 overflow-visible">
        <div className="container mx-auto flex justify-between items-center relative z-[10000] gap-2">
          <div className="flex items-center shrink-0">
            <Link href="/" className="text-base md:text-2xl font-bold bg-gradient-to-r from-[var(--navbar-text-gradient-start)] via-[var(--navbar-text-gradient-middle)] to-[var(--navbar-text-gradient-end)] bg-clip-text text-transparent hover:scale-105 transition-transform whitespace-nowrap">
              <span className="hidden sm:inline">XiaoleeChat ✨</span>
              <span className="sm:hidden">Xiaolee ✨</span>
            </Link>
          </div>
          
          <div className="flex items-center justify-end flex-1 space-x-1 md:space-x-3">
            {/* Navigation Buttons - Responsive */}
            <div className="flex items-center space-x-1 md:space-x-2 overflow-x-auto no-scrollbar py-1">
              <Link 
                href="/campaigns"
                className={`inline-flex items-center justify-center gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-2xl bg-gradient-to-r from-[var(--btn-primary-bg-start)] via-[var(--btn-primary-bg-middle)] to-[var(--btn-primary-bg-end)] px-2 md:px-6 py-1.5 md:py-3 text-[10px] sm:text-[11px] md:text-sm font-semibold text-[var(--btn-primary-text)] shadow-lg hover:from-[var(--btn-primary-hover-bg-start)] hover:via-[var(--btn-primary-hover-bg-middle)] hover:to-[var(--btn-primary-hover-bg-end)] transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--btn-primary-ring)] border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] h-[36px] md:h-[52px] ${pathname === '/campaigns' ? 'ring-4 ring-pink-300 scale-105' : ''}`}
              >
                <RocketLaunchIcon className="w-3.5 h-3.5 md:w-5 md:h-5 stroke-2 shrink-0" />
                <span className="font-semibold hidden lg:inline">{t('navbar.campaigns')}</span>
                <span className="font-semibold lg:hidden whitespace-nowrap">{t('navbar.campaigns').slice(0,4)}</span>
              </Link>

              <Link 
                href="/notifications"
                className={`inline-flex items-center justify-center gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-2 md:px-6 py-1.5 md:py-3 text-[10px] sm:text-[11px] md:text-sm font-semibold text-white shadow-lg hover:from-cyan-600 hover:via-blue-600 hover:to-indigo-600 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-300 border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] h-[36px] md:h-[52px] ${pathname === '/notifications' ? 'ring-4 ring-cyan-300 scale-105' : ''}`}
              >
                <BellIcon className="w-3.5 h-3.5 md:w-5 md:h-5 stroke-2 shrink-0" />
                <span className="font-semibold hidden lg:inline">{t('navbar.notifications')}</span>
                <span className="font-semibold lg:hidden whitespace-nowrap">{t('navbar.notifications').slice(0,5)}</span>
              </Link>

              <Link 
                href="/dashboard"
                className={`inline-flex items-center justify-center gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-2 md:px-6 py-1.5 md:py-3 text-[10px] sm:text-[11px] md:text-sm font-semibold text-white shadow-lg hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] h-[36px] md:h-[52px] ${pathname === '/dashboard' ? 'ring-4 ring-purple-300 scale-105' : ''}`}
              >
                <ChartBarIcon className="w-3.5 h-3.5 md:w-5 md:h-5 stroke-2 shrink-0" />
                <span className="font-semibold hidden lg:inline">{t('navbar.dashboard')}</span>
                <span className="font-semibold lg:hidden whitespace-nowrap">{t('navbar.dashboard').slice(0,4)}</span>
              </Link>
              
              {/*
              <Link 
                href="/test"
                className="inline-flex items-center justify-center gap-x-1 md:gap-x-2 rounded-xl md:rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-semibold text-white shadow-lg hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-orange-300 border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95 h-[40px] md:h-[52px]"
              >
                <span className="font-semibold hidden sm:inline">Test</span>
                <span className="text-sm md:text-lg">🧪</span>
              </Link>
              */}
            </div>
            
            {/* Show user dropdown only when data is loaded */}
            {isUserDataLoaded && userData ? (
              <div className="relative" data-dropdown>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center justify-center gap-x-1.5 md:gap-x-2 rounded-lg md:rounded-2xl bg-gradient-to-r from-[var(--btn-primary-bg-start)] via-[var(--btn-primary-bg-middle)] to-[var(--btn-primary-bg-end)] px-2 md:px-6 py-1.5 md:py-3 text-[10px] sm:text-[11px] md:text-sm font-semibold text-[var(--btn-primary-text)] shadow-lg hover:from-[var(--btn-primary-hover-bg-start)] hover:via-[var(--btn-primary-hover-bg-middle)] hover:to-[var(--btn-primary-hover-bg-end)] transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--btn-primary-ring)] border-white/20 backdrop-blur-sm transform hover:scale-105 active:scale-95 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] h-[36px] md:h-[52px]"
                >
                  <div className="w-4 h-4 md:w-5 md:h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                    <UserIcon className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden="true" />
                  </div>
                  <span className="hidden lg:inline">
                    {userData.session_id?.startsWith('devnet_guest_') ? 'Guest' : 'User'}
                  </span>
                  <ChevronDownIcon 
                    className={`h-3 w-3 md:h-4 md:w-4 shrink-0 transition-transform duration-200 ${
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
                        <div className="mr-3 text-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 w-8 h-8 rounded-lg flex items-center justify-center">
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
                        <div className="mr-3 text-lg bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 w-8 h-8 rounded-lg flex items-center justify-center">
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
                        <div className="mr-3 text-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 w-8 h-8 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="font-semibold">History</div>
                          <div className="text-xs text-[var(--navbar-text-gradient-middle)]/70">View conversations and activities</div>
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="border-t border-[var(--navbar-border)]/30 my-2"></div>

                      {/* Withdraw Button */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          toast.info('🚧 Withdraw functionality under development');
                          setIsDropdownOpen(false);
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 w-8 h-8 rounded-lg flex items-center justify-center">
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
                          toast.info('🚧 Deposit functionality under development');
                          setIsDropdownOpen(false);
                        }}
                        className="group flex w-full items-center px-4 py-3 text-sm font-medium text-[var(--navbar-text-gradient-start)] hover:bg-gradient-to-r hover:from-[var(--btn-primary-hover-bg-start)]/10 hover:to-[var(--btn-primary-hover-bg-end)]/10 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                      >
                        <div className="mr-3 text-lg bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 w-8 h-8 rounded-lg flex items-center justify-center">
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
        <div className="hidden md:block absolute top-6 right-32 text-sm animate-sparkle delay-200 cursor-none">
          ✨
        </div>
        <div className="hidden md:block absolute bottom-2 left-1/4 text-xs animate-gentle-bounce delay-500 cursor-none">
          💫
        </div>
        <div className="hidden md:block absolute bottom-4 right-16 text-sm animate-sparkle delay-700 cursor-none">
          🌟
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
        </>
      
    </>
  );
}
