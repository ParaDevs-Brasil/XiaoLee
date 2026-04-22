import React from 'react';

export default function TokenomicsCard() {
  return (
    <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-[2px] rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
      <div className="bg-white/90 backdrop-blur-md rounded-[22px] p-6 h-full">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
          🌸 $XLEE Tokenomics
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500 font-medium">Standard</span>
            <span className="text-gray-800 font-bold">SPL Token-2022</span>
          </div>
          
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500 font-medium">Network</span>
            <span className="text-purple-600 font-bold">Solana Devnet</span>
          </div>

          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500 font-medium">Transfer Fee (Burn)</span>
            <span className="text-pink-600 font-bold">0.5% nativo</span>
          </div>
          
          <div className="pt-4">
            <p className="text-xs text-gray-400 mb-1">Contract Address (Mint):</p>
            <code className="text-xs bg-gray-100 p-2 rounded-lg text-gray-600 break-all block w-full text-center">
              (Aguardando Deploy na Devnet)
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
