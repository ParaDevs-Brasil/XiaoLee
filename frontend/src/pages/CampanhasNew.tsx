import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import useCampaigns from '@/hooks/useCampaigns';
import { useCampaignActions } from '@/hooks/useCampaignActions';
import useUserCampaigns from '@/hooks/useUserCampaigns';

import UserData from '@/components/UserData';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import CreateCampaignForm from '@/components/campaigns/CreateCampaignForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UserCampaignsList } from '@/components/campaigns/UserCampaignsList';

export default function Campaigns() {
  const { campaigns, loading, error, refetch } = useCampaigns();
  const { campaigns: userCampaigns, loading: userCampaignsLoading, refetch: refetchUserCampaigns } = useUserCampaigns();
  const { joinCampaign, verifyTasks, claimReward, isJoinLoading, isVerifyLoading, isClaimLoading } = useCampaignActions();
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(UserData.hasData());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(UserData.getUserData());

  // Sync userCampaigns with UserData when userCampaigns change
  useEffect(() => {
    if (userCampaigns) {
      UserData.updateCampaigns(userCampaigns);
    }
  }, [userCampaigns]);

  useEffect(() => {
    // Check periodically if user has logged in (reduced frequency)
    const checkAuth = () => {
      const hasData = UserData.hasData();
      setIsUserAuthenticated(hasData);
      if (hasData) {
        setUserData(UserData.getUserData());
        // Refetch user campaigns when authenticated
        refetchUserCampaigns();
      }
    };

    const interval = setInterval(checkAuth, 3000); // Reduced from 1000ms to 3000ms
    
    // Listen for user data loaded event
    const handleUserDataLoaded = () => {
      setUserData(UserData.getUserData());
      setIsUserAuthenticated(true);
      // Refetch user campaigns when user data is loaded
      refetchUserCampaigns();
    };

    window.addEventListener('userDataLoaded', handleUserDataLoaded);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('userDataLoaded', handleUserDataLoaded);
    };
  }, [refetchUserCampaigns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      // Refresh user campaigns if authenticated
      if (isUserAuthenticated) {
        await refetchUserCampaigns();
        // Refetch user data (balances, transactions, etc.)
        await UserData.fetchData();
        setUserData(UserData.getUserData());
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleJoinCampaign = async (campaignId: number) => {
    if (!isUserAuthenticated) {
      toast.error('🔒 You need to be logged in to join campaigns!');
      return;
    }

    const result = await joinCampaign(campaignId);
    
    if (result.success) {
      toast.success(`✅ ${result.message}`);
      handleRefresh(); // Update lists and user data
      await refetchUserCampaigns(); // Refresh user campaigns
      // Refetch user data after joining (in case it affects user state)
      await UserData.fetchData();
      setUserData(UserData.getUserData());
    } else {
      toast.error(`❌ ${result.error}`);
    }
  };

  const handleVerifyTasks = async (campaignId: number) => {
    if (!isUserAuthenticated) {
      toast.error('🔒 You need to be logged in to verify tasks!');
      return;
    }

    const result = await verifyTasks(campaignId);
    
    if (result.success) {
      toast.success(`✅ ${result.message}`);
      // Refresh user campaigns after verification
      await refetchUserCampaigns();
      // Refetch user data after verifying tasks
      await UserData.fetchData();
      setUserData(UserData.getUserData());
    } else {
      toast.warning(`⚠️ ${result.message}`);
    }
  };

  const handleClaimReward = async (campaignId: number) => {
    if (!isUserAuthenticated) {
      toast.error('🔒 You need to be logged in to collect rewards!');
      return;
    }

    const result = await claimReward(campaignId);
    
    if (result.success) {
      toast.success(`🎉 ${result.message}`, {
        autoClose: 5000, // Show success message longer for rewards
      });
      // Refresh user campaigns after claiming
      await refetchUserCampaigns();
      // Refetch user data (balances, transactions, etc.) after claiming reward
      await UserData.fetchData();
      setUserData(UserData.getUserData());
    } else {
      toast.error(`❌ ${result.error}`);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    toast.success('✅ Campaign created successfully!');
    handleRefresh(); // Update campaign lists after creating campaign
    // Refetch user data after creating campaign (in case it affects balances)
    UserData.fetchData().then(() => {
      setUserData(UserData.getUserData());
    });
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
            {isUserAuthenticated 
              ? "Join campaigns and earn incredible rewards!" 
              : "Explore available campaigns. Login through chat to participate!"
            }
          </p>
          
          {/* Aviso para usuários não logados */}
          {!isUserAuthenticated && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 max-w-2xl mx-auto">
              <div className="flex items-center space-x-3 text-blue-700">
                <span className="text-3xl">🔒</span>
                <div className="text-left">
                  <p className="font-bold text-lg">Demo Mode</p>
                  <p className="text-blue-600">
                    You are viewing campaigns as a visitor. 
                    To participate, verify tasks and collect rewards, 
                    please login through the main chat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status and Create Button */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
              isUserAuthenticated 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {isUserAuthenticated 
                ? '✅ Authenticated' 
                : '👤 Demo Mode'
              }
            </div>
            
            {/* Botão para criar campanha - apenas para usuários logados */}
            {isUserAuthenticated && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105"
              >
                ✨ Create Campaign
              </button>
            )}
          </div>
        </div>

        {/* User campaigns section - show when authenticated */}
        {isUserAuthenticated && userCampaigns && userCampaigns.length > 0 && (
          <div className="mb-8">
            <UserCampaignsList 
              campaigns={userCampaigns} 
              title="🎯 My Campaigns"
              className="mb-8"
            />
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
              💡 How to participate in campaigns?
            </h3>
            <div className="text-sm text-purple-700 space-y-1">
              <p>1. 🏠 Go back to the main chat</p>
              <p>2. 🔑 Login through Twitter authentication</p>
              <p>3. 🚀 Return here to participate in campaigns</p>
              <p>4. 💰 Complete tasks and collect your rewards!</p>
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
