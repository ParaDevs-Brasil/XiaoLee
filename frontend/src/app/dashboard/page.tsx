"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/navbar/Navbar';
import TokenomicsCard from '../../components/dashboard/TokenomicsCard';
import UserStatsCard from '../../components/dashboard/UserStatsCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import { TypeUserData } from "@/interfaces";
import { ThemeProviderWrapper } from '@/providers/ThemeProvider';
import { useUserCampaigns } from '@/hooks/useUserCampaigns';
import { useLanguage } from '@/contexts/LanguageContext';
import UserData from '@/components/UserData';
import {
  IconTarget, IconCheck, IconAward, IconLock, IconUsers, IconGift,
  IconTrendingUp, IconActivity, IconCpu, IconZap, IconWifi, IconShield,
  type IconProps,
} from '@/components/icons';

// ── Campaign Summary Bar ───────────────────────────────────────────────────
function CampaignSummaryBar() {
  const { campaigns, loading } = useUserCampaigns();
  const { t } = useLanguage();

  const joined   = campaigns.length;
  const verified = campaigns.filter(c => c.participation_status === 'tasks_verified').length;
  const claimed  = campaigns.filter(c => c.tasks_claimed).length;

  const stats = [
    { label: t('dashboard.stat_campaigns'), value: joined,   Icon: IconTarget, sw: undefined, accent: "text-fuchsia-500",  bg: "bg-fuchsia-50",  border: "border-fuchsia-100" },
    { label: t('dashboard.stat_verified'),  value: verified, Icon: IconCheck,  sw: 2,          accent: "text-violet-500",   bg: "bg-violet-50",   border: "border-violet-100" },
    { label: t('dashboard.stat_rewarded'),  value: claimed,  Icon: IconAward,  sw: undefined, accent: "text-pink-500",     bg: "bg-pink-50",     border: "border-pink-100" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white/40 rounded-2xl border border-pink-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map(({ label, value, Icon, sw, accent, bg, border }) => (
        <div
          key={label}
          className={`rounded-2xl border ${border} ${bg} p-4 text-center hover:shadow-sm transition-shadow duration-200`}
        >
          <div className={`flex justify-center mb-2 ${accent}`}>
            <Icon className="w-4 h-4" sw={sw} />
          </div>
          <div className="text-2xl font-black text-gray-800 leading-none">{value}</div>
          <div className="text-sm text-gray-600 mt-1 font-semibold">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Global Economy Stat ────────────────────────────────────────────────────
function EconomyStat({ Icon, value, label, accent }: {
  Icon: (p: IconProps) => React.ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-pink-100 p-4 hover:shadow-sm transition-shadow duration-200">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent} bg-white border border-current/10 shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold text-gray-800 leading-tight">{value}</div>
        <div className="text-sm text-gray-600 font-semibold mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t } = useLanguage();
  const [userData, setUserData] = useState<TypeUserData | null>(null);

  useEffect(() => {
    // Navbar calls restoreSession() before this effect runs — read whatever is already set
    const existing = UserData.getUserData();
    if (existing?.user_info?.twitter_user_id) {
      setUserData(existing);
    }

    const handler = (e: Event) => {
      setUserData((e as CustomEvent<TypeUserData>).detail);
    };
    window.addEventListener('userDataLoaded', handler);
    return () => window.removeEventListener('userDataLoaded', handler);
  }, []);

  const twitterId = userData?.user_info?.twitter_user_id;

  return (
    <ThemeProviderWrapper>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-100 transition-colors duration-500">
        <Navbar />

        <main className="container mx-auto px-4 py-10 max-w-2xl">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent mb-2 leading-tight">
              {t('dashboard.title')}
            </h1>
            <p className="text-base text-gray-600 max-w-xs mx-auto leading-relaxed">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* ── Campaign Stats ─────────────────────────────────────────── */}
          <CampaignSummaryBar />

          {/* ── Tokenomics + User Stats ────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            <TokenomicsCard />
            <UserStatsCard isConnected={!!userData} twitterId={twitterId} />
          </div>

          {/* ── Global Economy ─────────────────────────────────────────── */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-fuchsia-400"><IconTrendingUp className="w-5 h-5" /></span>
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-widest">{t('dashboard.global_economy')}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <EconomyStat Icon={IconLock}      value="$1,240,500"  label={t('dashboard.tvl')}                  accent="text-emerald-500" />
              <EconomyStat Icon={IconUsers}     value="12,450"      label={t('dashboard.active_users')}         accent="text-blue-500" />
              <EconomyStat Icon={IconGift}      value="45,200 SOL"  label={t('dashboard.rewards_distributed')}  accent="text-purple-500" />
              <EconomyStat Icon={IconTrendingUp} value="1,120"      label={t('dashboard.campaigns_created')}    accent="text-fuchsia-500" />
            </div>
          </div>

          {/* ── Activity + Architecture ────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4">
            {/* Activity Feed */}
            <div className="rounded-2xl border border-pink-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-pink-100/60">
                <span className="text-fuchsia-400"><IconActivity className="w-4 h-4" /></span>
                <div>
                  <h2 className="text-sm font-bold text-gray-700">{t('dashboard.recent_activity')}</h2>
                  <p className="text-sm text-gray-600">{t('dashboard.recent_activity_sub')}</p>
                </div>
              </div>
              <div className="p-4">
                <ActivityFeed maxItems={5} />
              </div>
            </div>

            {/* Architecture */}
            <div className="rounded-2xl border border-pink-100 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-fuchsia-400"><IconCpu className="w-4 h-4" /></span>
                <h2 className="text-sm font-bold text-gray-700">{t('dashboard.architecture')}</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {t('dashboard.architecture_desc')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { Icon: IconShield, label: "Wallet-first" },
                  { Icon: IconCpu,    label: "IA Gemini" },
                  { Icon: IconZap,    label: "Jupiter" },
                  { Icon: IconWifi,   label: "Helius" },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-50/80 border border-pink-100">
                    <span className="text-fuchsia-400 shrink-0"><Icon className="w-4 h-4" /></span>
                    <span className="text-xs font-semibold text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-gray-500 font-medium uppercase tracking-widest mt-4 pt-3 border-t border-pink-100/60">
                {t('dashboard.footer')}
              </p>
            </div>
          </div>

        </main>
      </div>
    </ThemeProviderWrapper>
  );
}
