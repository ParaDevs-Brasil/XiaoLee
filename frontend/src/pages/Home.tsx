import React from 'react';
import AnimePanel from '../components/AnimePanel';
import ChatPanel from '../components/ChatPanel';

export default function Home() {
  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-10 text-4xl opacity-20 animate-bounce pointer-events-none">🌸</div>
      <div className="absolute top-40 right-20 text-3xl opacity-15 animate-pulse pointer-events-none">✨</div>
      <div className="absolute bottom-40 left-20 text-2xl opacity-20 animate-ping pointer-events-none">💕</div>
      <div className="absolute bottom-60 right-10 text-3xl opacity-15 animate-pulse delay-500 pointer-events-none">🌟</div>
      
      <main className="flex-1 w-full p-2 md:p-6 lg:p-8 relative z-10 overflow-hidden min-h-0">
        <div className="w-full h-full bg-[var(--main-bg)] rounded-2xl md:rounded-3xl p-2 md:p-6 lg:p-8 backdrop-blur-sm border border-white/10 flex flex-col lg:grid lg:grid-cols-3 gap-2 md:gap-6 lg:gap-8 overflow-hidden">
          <AnimePanel />
          <ChatPanel />
        </div>
      </main>
    </div>
  );
};


