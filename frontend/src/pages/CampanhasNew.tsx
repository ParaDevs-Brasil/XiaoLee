import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { toast } from 'react-toastify';
import useCampaigns from '@/hooks/useCampaigns';
import { useCampaignActions } from '@/hooks/useCampaignActions';
import useUserCampaigns from '@/hooks/useUserCampaigns';
import useNotifications from '@/hooks/useNotifications';

import UserData from '@/components/UserData';
import { connectEvmWallet, getStoredEvmAddress, isEvmWalletInstalled } from '@/lib/evmWallet';
import { useLanguage } from '@/contexts/LanguageContext';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UserCampaignsList } from '@/components/campaigns/UserCampaignsList';

// ── SVG Icons ──────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconMegaphone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
    <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/>
  </svg>
);

export default function Campaigns() {
  const { campaigns, loading, error, refetch } = useCampaigns();
  const { campaigns: userCampaigns, refetch: refetchUserCampaigns } = useUserCampaigns();
  const { notifications, loading: notificationsLoading, error: notificationsError, refetch: refetchNotifications, ackNotification, isAckLoading } = useNotifications();
  const { joinCampaign, verifyTasks, claimReward, isJoinLoading, isVerifyLoading, isClaimLoading } = useCampaignActions();
  const { t } = useLanguage();
  const [isCampaignReady, setIsCampaignReady] = useState(UserData.hasCampaignIdentity());
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = UserData.getSessionId();

  useEffect(() => {
    if (userCampaigns) UserData.updateCampaigns(userCampaigns);
  }, [userCampaigns]);

  useEffect(() => {
    const sessionId = UserData.getOrCreateDevnetSession();
    setIsCampaignReady(!!sessionId);
    // Only auto-sync a previously connected EVM wallet if no authenticated session exists
    const hasAuth = sessionId?.startsWith('tg_session_') || sessionId?.startsWith('google_session_');
    if (!hasAuth) {
      const maybeWallet = getStoredEvmAddress();
      if (maybeWallet) {
        setWalletAddress(maybeWallet);
        UserData.setDevnetWalletSession(maybeWallet);
      }
    }
    refetchUserCampaigns();
  }, [refetchUserCampaigns]);

  const handleConnectDevnetWallet = async () => {
    // If already authenticated via Telegram or Google, just confirm the session
    const currentSession = UserData.getSessionId();
    if (currentSession?.startsWith('tg_session_') || currentSession?.startsWith('google_session_')) {
      setIsCampaignReady(true);
      await refetchUserCampaigns();
      toast.success('Sessão autenticada sincronizada.');
      return;
    }
    // Otherwise try an injected EVM wallet (MetaMask etc.) for on-chain identity
    if (!isEvmWalletInstalled()) {
      toast.info('Sem carteira detectada. Continuando com sessão local.');
      const fallback = UserData.getOrCreateDevnetSession();
      setIsCampaignReady(!!fallback);
      return;
    }
    try {
      const address = await connectEvmWallet();
      UserData.setDevnetWalletSession(address);
      setWalletAddress(address);
      setIsCampaignReady(true);
      await refetchUserCampaigns();
      toast.success('Wallet conectada para campanhas.');
    } catch {
      toast.error('Não foi possível conectar a wallet.');
    }
  };

  useEffect(() => {
    const handler = () => { setIsCampaignReady(UserData.hasCampaignIdentity()); refetchUserCampaigns(); };
    window.addEventListener('userDataLoaded', handler);
    return () => window.removeEventListener('userDataLoaded', handler);
  }, [refetchUserCampaigns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      await refetchUserCampaigns();
      await refetchNotifications();
      await UserData.fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleJoinCampaign = async (campaignId: number) => {
    if (!isCampaignReady) { toast.error('Sessão Testnet não inicializada. Atualize e tente novamente.'); return; }
    const result = await joinCampaign(campaignId);
    if (result.success) { toast.success(result.message); handleRefresh(); await refetchUserCampaigns(); await UserData.fetchData(); }
    else { toast.error(result.error); }
  };

  const handleVerifyTasks = async (campaignId: number) => {
    if (!isCampaignReady) { toast.error('Sessão Testnet não inicializada. Atualize e tente novamente.'); return; }
    const result = await verifyTasks(campaignId);
    if (result.success) { toast.success(result.message); await refetchUserCampaigns(); await UserData.fetchData(); }
    else { toast.warning(result.message); }
  };

  const handleClaimReward = async (campaignId: number) => {
    if (!isCampaignReady) { toast.error('Sessão Testnet não inicializada. Atualize e tente novamente.'); return; }
    const result = await claimReward(campaignId);
    if (result.success) {
      const receiptSuffix = result.claim_receipt_id ? ` Receipt: ${result.claim_receipt_id}` : '';
      toast.success(`${result.message}${receiptSuffix}`, { autoClose: 5000 });
      await refetchUserCampaigns();
      await refetchNotifications();
      await UserData.fetchData();
    } else { toast.error(result.error); }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    toast.success('Campanha criada com sucesso!');
    handleRefresh();
    UserData.fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading campaigns..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center bg-white border border-red-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4 text-red-400">
            <IconAlert />
          </div>
          <h2 className="text-base font-bold text-gray-700 mb-2">Erro ao carregar campanhas</h2>
          <p className="text-sm text-gray-400 mb-5">{error}</p>
          <button onClick={handleRefresh} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all">
            <IconRefresh /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2 leading-tight">
            {t('campaigns.title')}
          </h1>
          <p className="text-base text-gray-600 max-w-xs mx-auto leading-relaxed">
            {t('campaigns.subtitle')}
          </p>
        </div>

        {/* ── Session Status Banner ────────────────────────────────────── */}
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 mb-6 ${
          isCampaignReady
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-amber-50 border-amber-100'
        }`}>
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
            isCampaignReady ? 'bg-emerald-100 text-emerald-500' : 'bg-amber-100 text-amber-500'
          }`}>
            {isCampaignReady ? <IconCheck /> : <IconClock />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">
              {isCampaignReady ? t('campaigns.session_active') : t('campaigns.guest_mode')}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {isCampaignReady
                ? t('campaigns.session_ready')
                : t('campaigns.session_connect')}
            </p>
          </div>
          {!isCampaignReady ? (
            <Link href="/" className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">
              Login
            </Link>
          ) : (
            <button onClick={handleConnectDevnetWallet} className="shrink-0 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold transition-colors">
              Sync Wallet
            </button>
          )}
        </div>

        {/* ── Create Campaign Button ───────────────────────────────────── */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-bold shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <IconPlus />
            {t('campaigns.create_campaign')}
          </button>
        </div>

        {/* ── My Campaigns ────────────────────────────────────────────── */}
        {userCampaigns && userCampaigns.length > 0 && (
          <div className="mb-6">
            <UserCampaignsList campaigns={userCampaigns} title="My Campaigns" />
          </div>
        )}

        {/* ── Recent Rewards (Notifications) ──────────────────────────── */}
        {(notifications.length > 0 || notificationsLoading || notificationsError) && (
          <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--accent)]"><IconBell /></span>
                <h2 className="text-sm font-bold text-gray-700">{t('campaigns.recent_rewards')}</h2>
              </div>
              <button onClick={refetchNotifications} className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                Atualizar
              </button>
            </div>

            <div className="p-4">
              {notificationsError && (
                <p className="text-xs text-red-500 mb-3">{notificationsError}</p>
              )}
              {notificationsLoading ? (
                <p className="text-xs text-gray-400 py-4 text-center">{t('campaigns.loading_notifications')}</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 3).map((notification) => (
                    <div key={notification.id} className={`rounded-xl border px-4 py-3 ${
                      notification.status === 'delivered'
                        ? 'border-emerald-100 bg-emerald-50/50'
                        : 'border-[var(--border)] bg-white'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${notification.status === 'delivered' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                            <p className="text-sm font-bold text-gray-800 truncate">{notification.title}</p>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-1">{notification.body}</p>
                          {notification.related_signature && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <span className="text-gray-300"><IconReceipt /></span>
                              <p className="text-[10px] text-gray-400 font-mono truncate">{notification.related_signature}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            notification.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            {notification.status}
                          </span>
                          {notification.status !== 'delivered' && (
                            <button
                              onClick={async () => {
                                try { await ackNotification(notification.id); toast.success('Notificação confirmada.'); }
                                catch { toast.error('Erro ao confirmar notificação.'); }
                              }}
                              disabled={isAckLoading(notification.id)}
                              className="text-[10px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors"
                            >
                              {isAckLoading(notification.id) ? '...' : 'Confirmar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Campaign List ────────────────────────────────────────────── */}
        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4 text-[var(--accent)]">
              <IconMegaphone />
            </div>
            <h2 className="text-sm font-bold text-gray-600 mb-1">Nenhuma campanha ativa</h2>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">Novas campanhas em breve. Verifique novamente em alguns instantes.</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
            >
              {refreshing ? <LoadingSpinner size="sm" /> : <IconRefresh />}
              {refreshing ? t('campaigns.refreshing') : t('campaigns.refresh')}
            </button>
          </div>
        ) : (
          <>
            {/* List header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                <span className="text-[var(--accent)]">{campaigns.length}</span> campanha{campaigns.length !== 1 ? 's' : ''} ativa{campaigns.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-[var(--accent)] font-semibold transition-colors disabled:opacity-50"
              >
                <IconRefresh />
                {refreshing ? t('campaigns.refreshing') : t('campaigns.refresh')}
              </button>
            </div>

            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  userCampaigns={userCampaigns ?? []}
                  onJoin={handleJoinCampaign}
                  onVerify={handleVerifyTasks}
                  onClaim={handleClaimReward}
                  isJoining={isJoinLoading}
                  isVerifying={isVerifyLoading}
                  isClaiming={isClaimLoading}
                  isCreator={!!currentUserId && currentUserId === campaign.creator_twitter_user_id}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[var(--accent)]"><IconTarget /></span>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Como funciona — Testnet</h3>
          </div>
          <ol className="space-y-2">
            {[
              'Participe de uma campanha e complete as etapas exigidas.',
              'Verifique as tasks para desbloquear o claim de reward.',
              'Reivindique o reward usando sua identidade de sessão Testnet.',
              'Atualize para sincronizar o status mais recente das campanhas.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="w-4 h-4 rounded-full bg-[var(--accent-soft)] border border-[var(--border)] text-[var(--accent)] font-bold flex items-center justify-center shrink-0 text-[10px]">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

      </div>

      {/* ── Create Campaign Modal ────────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Nova Campanha</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <IconX />
              </button>
            </div>
            <div className="p-5">
              <CreateCampaignForm
                onSuccess={handleCreateSuccess}
                onCancel={() => setShowCreateForm(false)}
                onError={(message) => toast.error(message)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
