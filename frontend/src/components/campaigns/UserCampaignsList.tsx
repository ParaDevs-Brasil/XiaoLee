import React from 'react';
import { UserCampaignParticipation } from '@/interfaces';

interface UserCampaignCardProps {
  campaign: UserCampaignParticipation;
  className?: string;
}

export const UserCampaignCard: React.FC<UserCampaignCardProps> = ({ 
  campaign, 
  className = '' 
}) => {
  const getStatusColor = (status: 'enrolled' | 'tasks_verified' | 'reward_claimed' | 'paid') => {
    switch (status) {
      case 'enrolled':
        return 'bg-blue-100 text-blue-800';
      case 'tasks_verified':
        return 'bg-yellow-100 text-yellow-800';
      case 'reward_claimed':
        return 'bg-green-100 text-green-800';
      case 'paid':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: 'enrolled' | 'tasks_verified' | 'reward_claimed' | 'paid') => {
    switch (status) {
      case 'enrolled':
        return '📝 Enrolled';
      case 'tasks_verified':
        return '✅ Tasks Verified';
      case 'reward_claimed':
        return '🎁 Reward Claimed';
      case 'paid':
        return '💰 Paid';
      default:
        return status;
    }
  };

  // Use participation_status if available, fallback to status for backward compatibility
  const currentStatus = campaign.participation_status || campaign.status;

  return (
    <div className={`bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{campaign.name}</h3>
          <p className="text-gray-600 text-sm mb-3">{campaign.description}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
          {getStatusText(currentStatus)}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="text-gray-500">Reward:</span>
            <span className="ml-1 font-semibold text-purple-600">
              {campaign.reward_per_participant} {campaign.reward_token}
            </span>
          </div>
        </div>
        
        {campaign.tasks_verified_at && (
          <div className="text-xs text-gray-500">
            Verified: {new Date(campaign.tasks_verified_at).toLocaleDateString()}
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
  campaigns, 
  className = '',
  title = "My Campaigns"
}) => {
  if (campaigns.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-xl p-8 text-center ${className}`}>
        <div className="text-4xl mb-3">🚀</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No campaigns yet</h3>
        <p className="text-gray-500">Join some campaigns to get started!</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <UserCampaignCard 
            key={campaign.id} 
            campaign={campaign} 
          />
        ))}
      </div>
    </div>
  );
};

export default UserCampaignsList;
