import React from 'react';
import UserData from '@/components/UserData';
import ActionButton from '@/components/ActionButton';
import { CampaignCardProps } from '@/interfaces/campaignComponents';

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onJoin,
  onVerify,
  onClaim,
  isJoining,
  isVerifying,
  isClaiming
}) => {
  const isUserAuthenticated = UserData.hasData();
  
  // Get user's participation status for this campaign from UserData
  // Note: UserData now gets updated by the useUserCampaigns hook
  const userCampaignParticipation = isUserAuthenticated 
    ? UserData.getUserCampaigns().find(uc => uc.id === campaign.id)
    : null;
  
  const isEnrolled = userCampaignParticipation?.status === 'enrolled';
  const isTasksVerified = userCampaignParticipation?.status === 'tasks_verified';
  const isPaid = userCampaignParticipation?.status === 'paid';
  const isTasksClaimed = userCampaignParticipation?.tasks_claimed === true;
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 hover:scale-105">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 flex-wrap">
          <h3 className="text-xl font-bold text-gray-800 ">{campaign.name}</h3>
          <div className='my-1'>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
            {(campaign.campaign_type).charAt(0).toUpperCase() + (campaign.campaign_type).slice(1)}
          </span>
           
          </div>
        </div>
       
      </div>
      
      <p className="text-gray-600 mb-4 line-clamp-3">{campaign.description}</p>
      
      {/* Campaign Stats */}
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-gray-500">
              Max: <span className="text-gray-700 font-semibold">{campaign.max_participants}</span>
            </p>
            <p className="text-gray-500">
              Completed: <span className="text-gray-700 font-semibold">{campaign.completed_participants || 0}</span>
            </p>
          </div>
          <div>
            <p className="text-gray-500">Pool:</p>
            <p className="text-gray-700 font-semibold">
              {campaign.reward_pool} {campaign.reward_token}
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl border border-pink-200 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 font-medium">Reward per participant:</span>
          <div className="flex items-center space-x-1">
            <span className="text-lg font-bold text-purple-700">
              {campaign.reward_per_participant}
            </span>
            <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
              {campaign.reward_token}
            </span>
          </div>
        </div>
      </div>
      
      {/* Task Requirements */}
      {(campaign.profile_to_follow || campaign.tweet_id_to_engage) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-blue-700">
            <span className="text-sm font-medium">📋 Tasks required:</span>
            <div className="text-xs mt-1 space-y-1 break-all flex flex-col flex-wrap">
              {campaign.profile_to_follow && (
                <div>• Follow:  <a className='underline' target='_blank' href={`www.x.com/${campaign.profile_to_follow}`}>{campaign.profile_to_follow}</a></div>
              )}
              {campaign.tweet_id_to_engage && (
                <div className='break-all break-words flex flex-wrap'>• Engage with tweet:  <a className='underline' target='_blank' href={`${campaign.tweet_id_to_engage}`}>{campaign.tweet_id_to_engage}</a></div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Warning for non-logged users */}
      {!isUserAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 text-yellow-700">
            <span className="text-sm">🔒</span>
            <span className="text-xs font-medium">Login to interact</span>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {/* Join Button */}
        {UserData.hasData() && UserData.verifyCampaignParticipation(campaign.id) ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2 text-blue-700">
              <span className="text-sm">✅</span>
              <span className="text-xs font-medium">
                {isPaid ? 'Campaign completed - Reward claimed!' : 
                 isTasksVerified ? 'Tasks verified - Ready to claim!' :
                 'Already joined this campaign'}
              </span>
            </div>
          </div>
        ) : (
          <ActionButton
            onClick={() => onJoin(campaign.id)}
            disabled={isJoining(campaign.id)}
            loading={isJoining(campaign.id)}
            loadingText="Joining..."
            variant="primary"
            isLocked={!isUserAuthenticated}
          >
            {!isUserAuthenticated ? "" : "Join 🚀"}
          </ActionButton>
        )}
        
        {/* Verify Button */}
        <ActionButton
          onClick={() => onVerify(campaign.id)}
          disabled={isVerifying(campaign.id) || !isEnrolled || isTasksVerified || isPaid}
          loading={isVerifying(campaign.id)}
          loadingText="Verifying..."
          variant="secondary"
          isLocked={!isUserAuthenticated}
        >
          {!isUserAuthenticated ? "" : 
           isTasksVerified || isPaid ? "Tasks Verified ✓" :
           !isEnrolled ? " Join First" :
           "Verify Tasks 🔍"}
        </ActionButton>
        
        {/* Claim Button */}
        <ActionButton
          onClick={() => onClaim(campaign.id)}
          disabled={isClaiming(campaign.id) || !isTasksVerified || isPaid || isTasksClaimed}
          loading={isClaiming(campaign.id)}
          loadingText="Claiming..."
          variant="success"
          isLocked={!isUserAuthenticated}
        >
          {!isUserAuthenticated ? "" :
           isPaid || isTasksClaimed ? "Reward Claimed 💎" :
           !isTasksVerified ? "Verify Tasks First" :
           "Claim Reward 💎"}
        </ActionButton>
      </div>
      
      {/* Campaign metadata */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>Created by: @{campaign.creator_twitter_user_id}</span>
          <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;
