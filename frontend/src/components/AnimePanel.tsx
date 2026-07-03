import React, { useState, useEffect, useRef } from 'react';
import Pfp from './Pfp';
import Video from './Video';

export default function AnimePanel() {
  const [currentPfp, setCurrentPfp] = useState(Video.getPfp());
  const [shouldLoop, setShouldLoop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const dragElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Match lg breakpoint (1024px)
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    Video.setPfp("xiaolee_hello.mov");

    const unsubscribe = Video.subscribe((newPfp, loop) => {
      setCurrentPfp(newPfp);
      setShouldLoop(loop);
    });

    return () => {
      unsubscribe();
      Video.stopIdleRotation();
      window.removeEventListener('resize', checkMobile);
    };
  }, [isMobile]);

  // Initialize drag functionality separately
  useEffect(() => {
    if (isMobile && dragElementRef.current) {
      dragElement(dragElementRef.current);
    }
  }, [isMobile]);

  const dragElement = (elmnt: HTMLElement) => {
    let pos1 = 0, pos2 = 0;

    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = dragTouchStart;

    function dragMouseDown(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

      const rect = elmnt.getBoundingClientRect();
      pos1 = e.clientX - rect.left;
      pos2 = e.clientY - rect.top;

      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function dragTouchStart(e: TouchEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = elmnt.getBoundingClientRect();
        pos1 = touch.clientX - rect.left;
        pos2 = touch.clientY - rect.top;

        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;
      }
    }

    function elementDrag(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      elmnt.style.left = (e.clientX - pos1) + "px";
      elmnt.style.top = (e.clientY - pos2) + "px";
    }

    function elementTouchDrag(e: TouchEvent) {
      e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        elmnt.style.left = (touch.clientX - pos1) + "px";
        elmnt.style.top = (touch.clientY - pos2) + "px";
      }
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
      document.ontouchend = null;
      document.ontouchmove = null;
    }
  };

  return (
    <>
      {isMobile ? (
        // Mobile: draggable floating avatar
        <div
          ref={dragElementRef}
          className="fixed z-50 w-[104px] h-[104px] cursor-move drag-handle select-none touch-none"
          style={{ position: 'fixed', top: '96px', left: '12px' }}
        >
          <div className="w-full h-full rounded-2xl overflow-hidden border border-pink-100 bg-white/70 backdrop-blur-md shadow-lg ring-soft relative">
            <div className="relative w-full h-full pointer-events-none">
              <Pfp pfp={currentPfp} loop={shouldLoop} />
            </div>
          </div>
        </div>
      ) : (
        // Desktop: clean glass card, avatar constrained to a stable aspect ratio
        <div className="w-full lg:col-span-1 h-full min-h-0 rounded-2xl border border-pink-100 bg-white/70 backdrop-blur-md shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100/60 shrink-0">
            <div>
              <h3 className="text-sm font-bold text-grad">Xiaolee</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your DeFi companion</p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* Avatar — centered, proportional, never stretched */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-5">
            <div className="relative w-full max-w-[300px] aspect-[3/4] max-h-full rounded-2xl overflow-hidden border border-pink-100 bg-gradient-to-b from-pink-50/60 to-purple-50/60 shadow-sm">
              <Pfp pfp={currentPfp} loop={shouldLoop} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
