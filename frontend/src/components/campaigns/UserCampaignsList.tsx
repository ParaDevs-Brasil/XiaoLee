import React from 'react';
import { UserCampaignParticipation } from '@/interfaces';

// ── SVG Icons ──────────────────────────────────────────────────────────────
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/>
  </svg>
);

interface UserCampaignCardProps {
  campaign: UserCampaignParticipation;
  className?: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  enrolled:       { label: 'Inscrito',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100' },
  tasks_verified: { label: 'Verificado', bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  paid:           { label: 'Claimed',    bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
};

export const UserCampaignCard: React.FC<UserCampaignCardProps> = ({ campaign, className = '' }) => {
  const currentStatus = campaign.participation_status;
  const cfg = statusConfig[currentStatus] ?? { label: currentStatus, bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-100' };

  return (
    <div className={`rounded-xl border border-pink-100 bg-white/70 backdrop-blur-sm p-4 hover:shadow-sm transition-shadow duration-150 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold text-gray-800 leading-tight flex-1 min-w-0">{campaign.name}</h3>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {currentStatus === 'paid' && <IconCheck />}
          {cfg.label}
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{campaign.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Reward:</span>
          <span className="text-xs font-black text-fuchsia-600">{campaign.reward_per_participant}</span>
          <span className="text-[10px] font-bold text-fuchsia-500 bg-fuchsia-50 px-1.5 py-0.5 rounded-full">{campaign.reward_token}</span>
        </div>
        {campaign.tasks_verified_at && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <IconReceipt />
            {new Date(campaign.tasks_verified_at).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
};

interface UserCampaignsListProps {
  campaigns: UserCampaignParticipation[];
  className?: string;
  title?: string;
}

export const UserCampaignsList: React.FC<UserCampaignsListProps> = ({
  campaigns, className = '', title = 'My Campaigns'
}) => {
  if (campaigns.length === 0) {
    return (
      <div className={`rounded-2xl border border-pink-100 bg-white/60 p-8 text-center ${className}`}>
        <div className="w-10 h-10 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center mx-auto mb-3 text-pink-300">
          <IconTarget />
        </div>
        <h3 className="text-sm font-bold text-gray-600 mb-1">Nenhuma campanha ainda</h3>
        <p className="text-xs text-gray-400">Participe de campanhas para começar!</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-fuchsia-400"><IconTarget /></span>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">{title}</h2>
      </div>
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <UserCampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </div>
  );
};

export default UserCampaignsList;
