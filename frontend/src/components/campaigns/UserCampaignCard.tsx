import React from 'react';
import ActionButton from '@/components/ActionButton';
import { UserCampaignCardProps } from '@/interfaces/campaignComponents';

const getStatusBadge = (status: string): React.ReactElement => {
  const badges: Record<string, React.ReactElement> = {
    'enrolled': <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">📝 Enrolled</span>,
    'tasks_verified': <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">✅ Verified</span>,
    'reward_claimed': <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">💎 Claimed</span>,
    'paid': <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">🎉 Paid</span>
  };
  return badges[status] || <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">❓ Unknown</span>;
};

const getCampaignTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'follow': '👥',
    'retweet': '🔄', 
    'like': '❤️',
    'reply': '💬',
    'airdrop': '🪂',
    'referral': '🤝'
  };
  return icons[type] || '🎯';
};

export const UserCampaignCard: React.FC<UserCampaignCardProps> = ({
  campaign,
  onVerify,
  onClaim,
  isVerifying,
  isClaiming
}) => {
  // Use new field name with fallback to old field name for backward compatibility
  const currentStatus = campaign.participation_status || campaign.status || 'enrolled';
  
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-2xl shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Campaign Type Icon */}
          <span className="text-2xl">
            {getCampaignTypeIcon(campaign.campaign_type)}
          </span>
          
          {/* Reward Display */}
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-indigo-600">
              {campaign.reward_per_participant}
            </span>
            <span className="text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 px-3 py-1 rounded-full shadow-sm">
              {campaign.reward_token}
            </span>
          </div>
        </div>
        {getStatusBadge(currentStatus)}
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-2">{campaign.name}</h3>
      <p className="text-gray-600 mb-4 text-sm leading-relaxed">{campaign.description}</p>
      
      {/* Campaign Type Badge */}
      <div className="mb-3">
        <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">
          {campaign.campaign_type.toUpperCase()} CAMPAIGN
        </span>
      </div>
      
      {campaign.tasks_verified_at && (
        <p className="text-xs text-green-600 mb-4">
          ✅ Tasks verified on: {new Date(campaign.tasks_verified_at).toLocaleDateString('en-US')}
        </p>
      )}
      
      <div className="space-y-2">
        {currentStatus === 'enrolled' && (
          <ActionButton
            onClick={() => onVerify(campaign.id)}
            disabled={isVerifying(campaign.id)}
            loading={isVerifying(campaign.id)}
            loadingText="Verifying... ⏳"
            variant="secondary"
          >
            Verify Tasks 🔍
          </ActionButton>
        )}
        
        {currentStatus === 'tasks_verified' && (
          <ActionButton
            onClick={() => onClaim(campaign.id)}
            disabled={isClaiming(campaign.id)}
            loading={isClaiming(campaign.id)}
            loadingText="Claiming... 💰"
            variant="success"
          >
            Claim {campaign.reward_per_participant} {campaign.reward_token} 💎
          </ActionButton>
        )}
        
        {(currentStatus === 'reward_claimed' || currentStatus === 'paid') && (
          <div className="w-full py-3 rounded-xl font-semibold text-center bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300">
            🎉 Reward of {campaign.reward_per_participant} {campaign.reward_token} {campaign.tasks_claimed ? 'claimed!' : 'processed!'}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCampaignCard;
