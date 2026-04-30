import React from 'react';
import { useXiaoLeeProgram } from '../../hooks/useXiaoLeeProgram';

interface UserStatsCardProps {
  twitterId?: string;
  isConnected: boolean;
}

export default function UserStatsCard({ twitterId, isConnected }: UserStatsCardProps) {
  const { userState, loading, error } = useXiaoLeeProgram(twitterId || null);

  if (!isConnected) {
    return (
      <div className="bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 p-[2px] rounded-3xl shadow-xl h-full">
        <div className="bg-white/90 backdrop-blur-md rounded-[22px] p-6 h-full flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-4 animate-bounce">🔒</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Carteira Desconectada</h2>
          <p className="text-sm text-gray-500">
            Conecte sua Phantom Wallet e associe seu Twitter para ver suas estatísticas on-chain!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-pink-400 via-fuchsia-500 to-purple-500 p-[2px] rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
      <div className="bg-white/90 backdrop-blur-md rounded-[22px] p-6 h-full">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent mb-4">
          ✨ Seus Swaps (On-Chain)
        </h2>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-orange-700 text-center">{error}</p>
          </div>
        ) : userState ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pink-50 p-4 rounded-2xl text-center">
              <p className="text-sm text-pink-500 font-semibold mb-1">Total Swaps</p>
              <p className="text-3xl font-bold text-pink-700">{userState.swapCount}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-2xl text-center">
              <p className="text-sm text-purple-500 font-semibold mb-1">Volume USDC</p>
              <p className="text-3xl font-bold text-purple-700">
                ${(userState.totalVolume / 1_000_000).toFixed(2)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
