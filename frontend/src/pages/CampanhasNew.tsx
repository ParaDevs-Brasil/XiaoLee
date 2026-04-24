import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import useCampaigns from '@/hooks/useCampaigns';
import { useCampaignActions } from '@/hooks/useCampaignActions';
import useUserCampaigns from '@/hooks/useUserCampaigns';
import useNotifications from '@/hooks/useNotifications';

import UserData from '@/components/UserData';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UserCampaignsList } from '@/components/campaigns/UserCampaignsList';

export default function Campaigns() {
  const { campaigns, loading, error, refetch } = useCampaigns();
  const { campaigns: userCampaigns, refetch: refetchUserCampaigns } = useUserCampaigns();
  const { notifications, loading: notificationsLoading, error: notificationsError, refetch: refetchNotifications, ackNotification, isAckLoading } = useNotifications();
  const { joinCampaign, verifyTasks, claimReward, isJoinLoading, isVerifyLoading, isClaimLoading } = useCampaignActions();
  const [isCampaignReady, setIsCampaignReady] = useState(UserData.hasCampaignIdentity());
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sync userCampaigns with UserData when userCampaigns change
  useEffect(() => {
    if (userCampaigns) {
      UserData.updateCampaigns(userCampaigns);
    }
  }, [userCampaigns]);

  useEffect(() => {
    const sessionId = UserData.getOrCreateDevnetSession();
    setIsCampaignReady(!!sessionId);

    const maybeWallet = (
      window as Window & { solana?: { publicKey?: { toString: () => string } } }
    ).solana?.publicKey?.toString();
    if (maybeWallet) {
      setWalletAddress(maybeWallet);
      UserData.setDevnetWalletSession(maybeWallet);
    }

    refetchUserCampaigns();
  }, [refetchUserCampaigns]);

  const handleConnectDevnetWallet = async () => {
    const provider = (
      window as Window & {
        solana?: {
          isPhantom?: boolean;
          publicKey?: { toString: () => string };
          connect?: () => Promise<{ publicKey: { toString: () => string } }>;
        };
      }
    ).solana;

    if (!provider || !provider.isPhantom || !provider.connect) {
      toast.info('🦊 Phantom não detectada. Continuando com sessão Devnet local.');
      const fallback = UserData.getOrCreateDevnetSession();
      setIsCampaignReady(!!fallback);
      return;
    }

    try {
      const resp = await provider.connect();
      const pubkey = resp.publicKey.toString();
      UserData.setDevnetWalletSession(pubkey);
      setWalletAddress(pubkey);
      setIsCampaignReady(true);
      await refetchUserCampaigns();
      toast.success('✅ Wallet Devnet conectada para campanhas.');
    } catch {
      toast.error('❌ Não foi possível conectar a wallet Devnet.');
    }
  };

  useEffect(() => {
    const handleUserDataLoaded = () => {
      setIsCampaignReady(UserData.hasCampaignIdentity());
      refetchUserCampaigns();
    };

    window.addEventListener('userDataLoaded', handleUserDataLoaded);
    return () => {
      window.removeEventListener('userDataLoaded', handleUserDataLoaded);
    };
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
    if (!isCampaignReady) {
      toast.error('⚠️ Unable to initialize Devnet session. Refresh and try again.');
      return;
    }

    const result = await joinCampaign(campaignId);
    
    if (result.success) {
      toast.success(`✅ ${result.message}`);
      handleRefresh(); // Update lists and user data
      await refetchUserCampaigns(); // Refresh user campaigns
      // Refetch user data after joining (in case it affects user state)
      await UserData.fetchData();
    } else {
      toast.error(`❌ ${result.error}`);
    }
  };

  const handleVerifyTasks = async (campaignId: number) => {
    if (!isCampaignReady) {
      toast.error('⚠️ Unable to initialize Devnet session. Refresh and try again.');
      return;
    }

    const result = await verifyTasks(campaignId);
    
    if (result.success) {
      toast.success(`✅ ${result.message}`);
      // Refresh user campaigns after verification
      await refetchUserCampaigns();
      // Refetch user data after verifying tasks
      await UserData.fetchData();
    } else {
      toast.warning(`⚠️ ${result.message}`);
    }
  };

  const handleClaimReward = async (campaignId: number) => {
    if (!isCampaignReady) {
      toast.error('⚠️ Unable to initialize Devnet session. Refresh and try again.');
      return;
    }

    const result = await claimReward(campaignId);
    
    if (result.success) {
      const receiptSuffix = result.claim_receipt_id ? ` Receipt: ${result.claim_receipt_id}` : '';
      toast.success(`🎉 ${result.message}${receiptSuffix}`, {
        autoClose: 5000, // Show success message longer for rewards
      });
      // Refresh user campaigns after claiming
      await refetchUserCampaigns();
      await refetchNotifications();
      // Refetch user data (balances, transactions, etc.) after claiming reward
      await UserData.fetchData();
    } else {
      toast.error(`❌ ${result.error}`);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    toast.success('✅ Campaign created successfully!');
    handleRefresh(); // Update campaign lists after creating campaign
    // Refetch user data after creating campaign (in case it affects balances)
    UserData.fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Loading campaigns..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center bg-red-50 p-8 rounded-2xl border border-red-200">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Error loading campaigns</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={handleRefresh}
            className="bg-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header da página */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
            🚀 Campaigns 
          </h1>
          <p className="text-gray-600 text-lg mb-6">
            Join campaigns and earn incredible rewards on Solana Devnet.
          </p>

          {/* Status and Create Button */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
              isCampaignReady 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {isCampaignReady 
                ? '✅ Devnet Session Active' 
                : '⏳ Initializing Devnet Session'
              }
            </div>
            
            <button
              onClick={handleConnectDevnetWallet}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 transform hover:scale-105"
            >
              🔌 Connect Phantom (Devnet)
            </button>

            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105"
            >
              ✨ Create Campaign
            </button>

            {walletAddress && (
              <div className="inline-block px-3 py-2 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
            )}
          </div>
        </div>

        {/* User campaigns section - show when authenticated */}
        {userCampaigns && userCampaigns.length > 0 && (
          <div className="mb-8">
            <UserCampaignsList 
              campaigns={userCampaigns} 
              title="🎯 My Campaigns"
              className="mb-8"
            />
          </div>
        )}

        {(notifications.length > 0 || notificationsLoading || notificationsError) && (
          <div className="mb-8 bg-white rounded-3xl border border-gray-200 shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span>🔔</span>
                Recent Rewards
              </h2>
              <button
                onClick={refetchNotifications}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            {notificationsError && (
              <p className="text-sm text-red-600 mb-3">{notificationsError}</p>
            )}

            {notificationsLoading ? (
              <p className="text-sm text-gray-500">Loading notifications...</p>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 3).map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-800">{notification.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
                        {notification.related_signature && (
                          <p className="text-xs text-blue-700 mt-2 break-all">
                            Receipt: {notification.related_signature}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-semibold uppercase text-blue-700 bg-white px-2 py-1 rounded-full border border-blue-200">
                          {notification.status}
                        </span>
                        {notification.status !== 'delivered' && (
                          <button
                            onClick={async () => {
                              try {
                                await ackNotification(notification.id);
                                toast.success('✅ Notification acknowledged.');
                              } catch {
                                toast.error('❌ Failed to acknowledge notification.');
                              }
                            }}
                            disabled={isAckLoading(notification.id)}
                            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1 rounded-full"
                          >
                            {isAckLoading(notification.id) ? 'Acking...' : 'Mark delivered'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Lista de campanhas */}
        {campaigns.length === 0 ? (
          <div className="text-center bg-gray-50 p-12 rounded-3xl border border-gray-200">
            <div className="text-6xl mb-4">📢</div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              No active campaigns at the moment
            </h2>
            <p className="text-gray-600 text-lg mb-6">
              New campaigns coming soon! Check back in a few moments.
            </p>
            <button 
              onClick={handleRefresh}
              className="bg-gradient-to-r from-pink-400 to-purple-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-500 hover:to-purple-600 transition-all duration-200 disabled:opacity-50"
              disabled={refreshing}
            >
              {refreshing ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>Refreshing...</span>
                </div>
              ) : (
                <>🔄 Refresh</>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-700 text-lg">
                <span className="font-bold text-purple-600">{campaigns.length}</span> active campaign{campaigns.length !== 1 ? 's' : ''}
              </p>
              <button 
                onClick={handleRefresh}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-colors flex items-center space-x-2 disabled:opacity-50"
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <CampaignCard 
                  key={campaign.id} 
                  campaign={campaign}
                  onJoin={handleJoinCampaign}
                  onVerify={handleVerifyTasks}
                  onClaim={handleClaimReward}
                  isJoining={isJoinLoading}
                  isVerifying={isVerifyLoading}
                  isClaiming={isClaimLoading}
                />
              ))}
            </div>
          </>
        )}

        {/* Footer informativo */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-200">
            <h3 className="text-lg font-bold text-purple-800 mb-2">
              💡 Campaigns running on Devnet
            </h3>
            <div className="text-sm text-purple-700 space-y-1">
              <p>1. 🚀 Join a campaign and complete required steps</p>
              <p>2. ✅ Verify tasks to unlock reward claim</p>
              <p>3. 💰 Claim reward using your Devnet session identity</p>
              <p>4. 🔄 Refresh to sync your latest campaign status</p>
            </div>
          </div>
        </div>

        {/* Modal de criação de campanha */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">✨ Create New Campaign</h2>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                
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
    </div>
  );
}
