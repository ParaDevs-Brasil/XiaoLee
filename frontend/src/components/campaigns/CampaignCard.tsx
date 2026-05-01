import React from 'react';
import UserData from '@/components/UserData';
import ActionButton from '@/components/ActionButton';
import { CampaignCardProps } from '@/interfaces/campaignComponents';

// ── SVG Icons ──────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconList = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign, onJoin, onVerify, onClaim, isJoining, isVerifying, isClaiming
}) => {
  const hasCampaignIdentity = UserData.hasCampaignIdentity();
  const userCampaignParticipation = hasCampaignIdentity
    ? UserData.getUserCampaigns().find(uc => uc.id === campaign.id)
    : null;

  const isEnrolled      = userCampaignParticipation?.participation_status === 'enrolled';
  const isTasksVerified = userCampaignParticipation?.participation_status === 'tasks_verified';
  const isPaid          = userCampaignParticipation?.participation_status === 'paid';
  const isTasksClaimed  = userCampaignParticipation?.tasks_claimed === true;

  // Progress bar
  const pct = campaign.max_participants > 0
    ? Math.min(100, Math.round((campaign.completed_participants / campaign.max_participants) * 100))
    : 0;
  const barColor = pct >= 90 ? 'bg-rose-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400';
  const spotsLeft = campaign.max_participants - (campaign.completed_participants || 0);

  return (
    <div className="rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow duration-200">

      {/* Card Header */}
      <div className="px-5 py-4 border-b border-pink-100/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 leading-tight mb-1">{campaign.name}</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400 bg-fuchsia-50 border border-fuchsia-100 px-2 py-0.5 rounded-full">
              {campaign.campaign_type}
            </span>
          </div>
          {(isPaid || isTasksClaimed) && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
              <IconCheck /> Claimed
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-3">
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{campaign.description}</p>
      </div>

      {/* Stats + Progress */}
      <div className="px-5 pb-3">
        <div className="rounded-xl bg-gray-50/80 border border-gray-100 p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Máx.</span>
              <span className="font-semibold text-gray-700">{campaign.max_participants}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pool</span>
              <span className="font-semibold text-gray-700">{campaign.reward_pool} {campaign.reward_token}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Inscritos</span>
              <span className="font-semibold text-gray-700">{campaign.completed_participants || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Vagas</span>
              <span className={`font-semibold ${spotsLeft === 0 ? 'text-rose-500' : 'text-gray-700'}`}>
                {spotsLeft === 0 ? 'Esgotado' : spotsLeft}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Vagas preenchidas</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Reward */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/60 px-4 py-2.5">
          <span className="text-xs text-gray-500 font-medium">Reward por participante</span>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-fuchsia-600">{campaign.reward_per_participant}</span>
            <span className="text-xs font-bold text-fuchsia-500 bg-fuchsia-100 px-2 py-0.5 rounded-full">{campaign.reward_token}</span>
          </div>
        </div>
      </div>

      {/* Tasks required */}
      {(campaign.profile_to_follow || campaign.tweet_id_to_engage) && (
        <div className="px-5 pb-3">
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-violet-400"><IconList /></span>
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Tasks obrigatórias</span>
            </div>
            <div className="space-y-1 text-xs text-violet-700">
              {campaign.profile_to_follow && (
                <div>Seguir: <a className="underline font-medium" target="_blank" rel="noreferrer" href={`https://x.com/${campaign.profile_to_follow.replace(/^@/, '')}`}>{campaign.profile_to_follow}</a></div>
              )}
              {campaign.tweet_id_to_engage && (
                <div className="break-all">Engajar: <a className="underline font-medium" target="_blank" rel="noreferrer" href={campaign.tweet_id_to_engage}>{campaign.tweet_id_to_engage}</a></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No identity warning */}
      {!hasCampaignIdentity && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-600">
            <IconAlert />
            <span className="text-xs font-medium">Sessão Devnet não inicializada</span>
          </div>
        </div>
      )}

      {/* Status info when already participating */}
      {hasCampaignIdentity && UserData.verifyCampaignParticipation(campaign.id) && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-600">
            <IconCheck />
            <span className="text-xs font-medium">
              {isPaid ? 'Reward já reivindicado.' :
               isTasksVerified ? 'Tasks verificadas — pronto para claim.' :
               'Já inscrito nesta campanha.'}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 space-y-2">
        {/* Join */}
        {!(hasCampaignIdentity && UserData.verifyCampaignParticipation(campaign.id)) && (
          <ActionButton
            onClick={() => onJoin(campaign.id)}
            disabled={isJoining(campaign.id)}
            loading={isJoining(campaign.id)}
            loadingText="Entrando..."
            variant="primary"
            isLocked={!hasCampaignIdentity}
          >
            {!hasCampaignIdentity ? 'Aguardando Sessão Devnet' : 'Participar'}
          </ActionButton>
        )}

        {/* Verify */}
        <ActionButton
          onClick={() => onVerify(campaign.id)}
          disabled={isVerifying(campaign.id) || !isEnrolled || isTasksVerified || isPaid}
          loading={isVerifying(campaign.id)}
          loadingText="Verificando..."
          variant="secondary"
          isLocked={!hasCampaignIdentity}
        >
          {!hasCampaignIdentity ? 'Aguardando Sessão Devnet' :
           isTasksVerified || isPaid ? 'Tasks Verificadas' :
           !isEnrolled ? 'Participe Primeiro' :
           'Verificar Tasks'}
        </ActionButton>

        {/* Claim */}
        <ActionButton
          onClick={() => onClaim(campaign.id)}
          disabled={isClaiming(campaign.id) || !isTasksVerified || isPaid || isTasksClaimed}
          loading={isClaiming(campaign.id)}
          loadingText="Reivindicando..."
          variant="success"
          isLocked={!hasCampaignIdentity}
        >
          {!hasCampaignIdentity ? 'Aguardando Sessão Devnet' :
           isPaid || isTasksClaimed ? 'Reward Reivindicado' :
           !isTasksVerified ? 'Verifique as Tasks Primeiro' :
           'Reivindicar Reward'}
        </ActionButton>
      </div>

      {/* Footer meta */}
      <div className="px-5 pb-4 pt-0">
        <div className="flex justify-between items-center text-[10px] text-gray-300 border-t border-pink-100/60 pt-3">
          <span>@{campaign.creator_twitter_user_id}</span>
          <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
        </div>
      </div>

    </div>
  );
};

export default CampaignCard;
