"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/navbar/Navbar';
import TokenomicsCard from '../../components/dashboard/TokenomicsCard';
import UserStatsCard from '../../components/dashboard/UserStatsCard';
import { TypeUserData } from "@/interfaces";
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';

export default function DashboardPage() {
  const [userData, setUserData] = useState<TypeUserData | null>(null);

  useEffect(() => {
    // Listen for the custom event emitted by Navbar/User sync
    const handleUserDataLoaded = (event: Event) => {
      const customEvent = event as CustomEvent<TypeUserData>;
      setUserData(customEvent.detail);
    };

    window.addEventListener('userDataLoaded', handleUserDataLoaded);
    return () => {
      window.removeEventListener('userDataLoaded', handleUserDataLoaded);
    };
  }, []);

  const twitterId = userData?.user_info?.twitter_user_id;

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 transition-colors duration-500">
        <Navbar />
        
        <main className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent mb-4 animate-pulse">
              XiaoLee Protocol Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Acompanhe as métricas globais da economia XiaoLee e veja seus stats registrados imutavelmente na Solana Devnet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Global Stats */}
            <div className="h-full">
              <TokenomicsCard />
            </div>

            {/* Personal Stats */}
            <div className="h-full">
              <UserStatsCard 
                isConnected={!!userData} 
                twitterId={twitterId} 
              />
            </div>
          </div>

          <div className="mt-16 max-w-5xl mx-auto">
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-lg text-center">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                Arquitetura Descentralizada 🚀
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A XiaoLee utiliza Program Derived Addresses (PDAs) para conectar sua identidade Web2 (Twitter) à Web3 (Solana) com segurança, sem necessidade de chaves privadas centralizadas.
              </p>
            </div>
          </div>
        </main>
      </div>
    </ThemeProviderWrapper>
  );
}
