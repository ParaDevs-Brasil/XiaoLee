import React from 'react';
import { useXiaoLeeProgram } from '../../hooks/useXiaoLeeProgram';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserStatsCardProps {
  twitterId?: string;
  isConnected: boolean;
}

const IconWallet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
);
const IconBarChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

export default function UserStatsCard({ twitterId, isConnected }: UserStatsCardProps) {
  const { t } = useLanguage();
  const { userState, loading, errorCode } = useXiaoLeeProgram(twitterId || null);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-pink-100 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-fuchsia-400"><IconBarChart /></span>
          <h2 className="text-sm font-bold text-gray-700">{t('user_stats.title')}</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-3 text-pink-300">
            <IconWallet />
          </div>
          <h3 className="text-sm font-bold text-gray-700 mb-1">{t('user_stats.disconnected_title')}</h3>
          <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
            {t('user_stats.disconnected_sub')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pink-100 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-fuchsia-400"><IconBarChart /></span>
        <h2 className="text-sm font-bold text-gray-700">{t('user_stats.title')}</h2>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-pink-200 border-t-fuchsia-500" />
        </div>
      ) : errorCode ? (
        <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
          <p className="text-sm text-orange-700 font-semibold text-center">
            {t(errorCode === 'not_found' ? 'user_stats.no_data' : 'user_stats.connection_error')}
          </p>
        </div>
      ) : userState ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-pink-50 border border-pink-100 p-4 text-center">
            <p className="text-sm text-pink-500 font-semibold mb-1">{t('user_stats.total_swaps')}</p>
            <p className="text-2xl font-black text-pink-600">{userState.swapCount}</p>
          </div>
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-center">
            <p className="text-sm text-purple-500 font-semibold mb-1">{t('user_stats.volume_usdc')}</p>
            <p className="text-2xl font-black text-purple-600">
              ${(userState.totalVolume / 1_000_000).toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
