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

// ── Inline SVG icons — sem emojis ──────────────────────────────────────────
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconAward = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconGift = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);
const IconTrendingUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconCpu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);
const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconWifi = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

// ── Campaign Summary Bar ───────────────────────────────────────────────────
function CampaignSummaryBar() {
  const { campaigns, loading } = useUserCampaigns();
  const { t } = useLanguage();

  const joined   = campaigns.length;
  const verified = campaigns.filter(c => c.participation_status === 'tasks_verified').length;
  const claimed  = campaigns.filter(c => c.tasks_claimed).length;

  const stats = [
    { label: t('dashboard.stat_campaigns'), value: joined,   Icon: IconTarget, accent: "text-fuchsia-500",  bg: "bg-fuchsia-50",  border: "border-fuchsia-100" },
    { label: t('dashboard.stat_verified'),  value: verified, Icon: IconCheck,  accent: "text-violet-500",   bg: "bg-violet-50",   border: "border-violet-100" },
    { label: t('dashboard.stat_rewarded'),  value: claimed,  Icon: IconAward,  accent: "text-pink-500",     bg: "bg-pink-50",     border: "border-pink-100" },
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
      {stats.map(({ label, value, Icon, accent, bg, border }) => (
        <div
          key={label}
          className={`rounded-2xl border ${border} ${bg} p-4 text-center hover:shadow-sm transition-shadow duration-200`}
        >
          <div className={`flex justify-center mb-2 ${accent}`}>
            <Icon />
          </div>
          <div className="text-2xl font-black text-gray-800 leading-none">{value}</div>
          <div className="text-xs text-gray-400 mt-1 font-medium">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Global Economy Stat ────────────────────────────────────────────────────
function EconomyStat({ Icon, value, label, accent }: {
  Icon: () => React.ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-2xl border border-pink-100 p-4 hover:shadow-sm transition-shadow duration-200">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent} bg-white border border-current/10 shadow-sm`}>
        <Icon />
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold text-gray-800 leading-tight">{value}</div>
        <div className="text-xs text-gray-400 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t } = useLanguage();
  const [userData, setUserData] = useState<TypeUserData | null>(null);

  useEffect(() => {
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
            <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
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
              <span className="text-fuchsia-400"><IconTrendingUp /></span>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.global_economy')}</h2>
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
            <div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-pink-100/60">
                <span className="text-fuchsia-400"><IconActivity /></span>
                <div>
                  <h2 className="text-sm font-bold text-gray-700">{t('dashboard.recent_activity')}</h2>
                  <p className="text-xs text-gray-400">{t('dashboard.recent_activity_sub')}</p>
                </div>
              </div>
              <div className="p-4">
                <ActivityFeed maxItems={5} />
              </div>
            </div>

            {/* Architecture */}
            <div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-fuchsia-400"><IconCpu /></span>
                <h2 className="text-sm font-bold text-gray-700">{t('dashboard.architecture')}</h2>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
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
                    <span className="text-fuchsia-400 shrink-0"><Icon /></span>
                    <span className="text-xs font-semibold text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] text-gray-300 uppercase tracking-widest mt-4 pt-3 border-t border-pink-100/60">
                {t('dashboard.footer')}
              </p>
            </div>
          </div>

        </main>
      </div>
    </ThemeProviderWrapper>
  );
}
