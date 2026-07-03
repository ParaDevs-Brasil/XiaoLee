import React from 'react';
import AnimePanel from '../components/AnimePanel';
import ChatPanel from '../components/ChatPanel';

export default function Home() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <main className="flex-1 w-full relative z-10 overflow-hidden min-h-0">
        <div className="mx-auto h-full w-full max-w-[1180px] p-3 md:p-6 flex flex-col lg:grid lg:grid-cols-3 gap-3 md:gap-5 overflow-hidden">
          <AnimePanel />
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
