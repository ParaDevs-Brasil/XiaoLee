import React from 'react';
import AnimePanel from '../components/AnimePanel';
import ChatPanel from '../components/ChatPanel';

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-10 text-4xl opacity-20 animate-bounce">🌸</div>
      <div className="absolute top-40 right-20 text-3xl opacity-15 animate-pulse">✨</div>
      <div className="absolute bottom-40 left-20 text-2xl opacity-20 animate-ping">💕</div>
      <div className="absolute bottom-60 right-10 text-3xl opacity-15 animate-pulse delay-500">🌟</div>
      
      <main className="flex flex-1 p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-hidden relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full w-full bg-[var(--main-bg)] rounded-3xl p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 backdrop-blur-sm border border-white/10">
          <AnimePanel />
          <ChatPanel />
        </div>
      </main>
    </div>
  );
};


