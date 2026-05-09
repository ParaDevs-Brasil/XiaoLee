import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const IconToken = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);

export default function TokenomicsCard() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-fuchsia-400"><IconToken /></span>
        <h2 className="text-sm font-bold text-gray-700">{t('tokenomics.title')}</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-gray-100/80">
          <span className="text-xs text-gray-400 font-medium">{t('tokenomics.standard')}</span>
          <span className="text-xs text-gray-700 font-semibold">SPL Token-2022</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100/80">
          <span className="text-xs text-gray-400 font-medium">{t('tokenomics.network')}</span>
          <span className="text-xs font-semibold text-violet-500">Solana Devnet</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100/80">
          <span className="text-xs text-gray-400 font-medium">{t('tokenomics.transfer_fee')}</span>
          <span className="text-xs font-semibold text-fuchsia-500">{t('tokenomics.fee_value')}</span>
        </div>

        <div className="pt-1">
          <p className="text-xs text-gray-400 mb-1.5">{t('tokenomics.contract_address')}</p>
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
            <code className="text-xs text-gray-400 italic block text-center">
              {t('tokenomics.awaiting_deploy')}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
