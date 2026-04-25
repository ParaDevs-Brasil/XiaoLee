"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/navbar/Navbar';
import TokenomicsCard from '../../components/dashboard/TokenomicsCard';
import UserStatsCard from '../../components/dashboard/UserStatsCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import { TypeUserData } from "@/interfaces";
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';
import { useUserCampaigns } from '@/hooks/useUserCampaigns';

function CampaignSummaryBar() {
  const { campaigns, loading } = useUserCampaigns();

  const joined   = campaigns.length;
  const verified = campaigns.filter(c => c.participation_status === 'tasks_verified').length;
  const claimed  = campaigns.filter(c => c.tasks_claimed).length;

  const stats = [
    { label: "Campanhas", value: joined,   icon: "🎯", color: "from-pink-400 to-rose-500" },
    { label: "Verificadas",  value: verified, icon: "✅", color: "from-blue-400 to-indigo-500" },
    { label: "Premiadas",  value: claimed,  icon: "💎", color: "from-yellow-400 to-orange-400" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 mb-8 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white/30 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {stats.map(({ label, value, icon, color }) => (
        <div key={label}
          className={`bg-gradient-to-br ${color} p-[2px] rounded-2xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300`}
        >
          <div className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm rounded-[14px] p-4 text-center">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-2xl font-extrabold text-gray-800 dark:text-white">{value}</div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<TypeUserData | null>(null);

  useEffect(() => {
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
          {/* Hero */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent mb-4 animate-pulse">
              XiaoLee Protocol Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Acompanhe as métricas globais da economia XiaoLee e veja seus stats registrados imutavelmente na Solana Devnet.
            </p>
          </div>

          {/* Barra de resumo de campanhas */}
          <div className="max-w-5xl mx-auto">
            <CampaignSummaryBar />
          </div>

          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="h-full">
              <TokenomicsCard />
            </div>
            <div className="h-full">
              <UserStatsCard
                isConnected={!!userData}
                twitterId={twitterId}
              />
            </div>
          </div>

          {/* Global Economy Stats */}
          <div className="max-w-5xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
              <span>📈</span> Economia XiaoLee (Global)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Value Locked", value: "$1,240,500", icon: "🔒", color: "text-green-600" },
                { label: "Active Users", value: "12,450", icon: "👥", color: "text-blue-600" },
                { label: "Rewards Distributed", value: "45,200 SOL", icon: "🎁", color: "text-purple-600" },
                { label: "Campaigns Created", value: "1,120", icon: "🔥", color: "text-orange-600" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-sm transition-all hover:shadow-md">
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed + Arquitetura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 max-w-5xl mx-auto">
            {/* Feed de atividade */}
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-lg">
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-4 flex items-center gap-2">
                <span>🔔</span> Atividade Recente
              </h2>
              <ActivityFeed maxItems={5} />
            </div>

            {/* Arquitetura */}
            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-lg flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <span>🚀</span> Arquitetura Descentralizada
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  A XiaoLee utiliza Program Derived Addresses (PDAs) para conectar sua identidade
                  Web2 (Twitter) à Web3 (Solana) com segurança, sem necessidade de chaves privadas centralizadas.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: "🔐", label: "Wallet-first" },
                    { icon: "🤖", label: "IA Gemini" },
                    { icon: "⚡", label: "Jupiter" },
                    { icon: "📡", label: "Helius" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2 p-2 rounded-xl bg-white/50 dark:bg-white/5">
                      <span className="text-xl">{icon}</span>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center uppercase tracking-widest">
                  Solana Devnet · MVP 2.0 · Powered by XiaoLee Core
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ThemeProviderWrapper>
  );
}


