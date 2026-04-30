import React, { useState, useEffect, useRef } from 'react';
import Pfp from './Pfp';
import Video from './Video';

export default function AnimePanel() {
  const [currentPfp, setCurrentPfp] = useState(Video.getPfp());
  const [shouldLoop, setShouldLoop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Ref for the draggable element
  const dragElementRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Check if we're on mobile - only runs on client side
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Match lg breakpoint (1024px)
    };
    
    // Initial check
    checkMobile();
    // Listen for resize events
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
  }, [isMobile]); // Keep log and initialization aligned with the tracked mobile state

  // Initialize drag functionality separately
  useEffect(() => {
    console.log("useEffect for drag - isMobile:", isMobile, "dragElementRef.current:", !!dragElementRef.current);
    if (isMobile && dragElementRef.current) {
      console.log("Initializing drag functionality for mobile");
      dragElement(dragElementRef.current);
    }
  }, [isMobile]); // Run when isMobile changes

  // JavaScript drag implementation
  const dragElement = (elmnt: HTMLElement) => {
    console.log("Setting up drag for element:", elmnt);
    console.log("Element classList:", elmnt.className);
    let pos1 = 0, pos2 = 0;
    // pos3 and pos4 removed as they were unused
    
    // Use the entire element as draggable area
    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = dragTouchStart;
    
    console.log("Event handlers attached - mouse:", !!elmnt.onmousedown, "touch:", !!elmnt.ontouchstart);

    function dragMouseDown(e: MouseEvent) {
      console.log("Mouse down detected");
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate offset from mouse to element's top-left corner
      const rect = elmnt.getBoundingClientRect();
      pos1 = e.clientX - rect.left;
      pos2 = e.clientY - rect.top;
      
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
      
      console.log("Drag started at:", e.clientX, e.clientY);
    }

    function dragTouchStart(e: TouchEvent) {
      console.log("Touch start detected");
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        
        // Calculate offset from touch to element's top-left corner
        const rect = elmnt.getBoundingClientRect();
        pos1 = touch.clientX - rect.left;
        pos2 = touch.clientY - rect.top;
        
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementTouchDrag;
        
        console.log("Touch drag started at:", touch.clientX, touch.clientY);
      }
    }

    function elementDrag(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      
      // Calculate new position based on mouse position minus offset
      const newLeft = e.clientX - pos1;
      const newTop = e.clientY - pos2;
      
      // Set the element's new position:
      elmnt.style.left = newLeft + "px";
      elmnt.style.top = newTop + "px";
      
      console.log("Dragging to:", newLeft, newTop);
    }

    function elementTouchDrag(e: TouchEvent) {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        
        // Calculate new position based on touch position minus offset
        const newLeft = touch.clientX - pos1;
        const newTop = touch.clientY - pos2;
        
        // Set the element's new position:
        elmnt.style.left = newLeft + "px";
        elmnt.style.top = newTop + "px";
        
        console.log("Touch dragging to:", newLeft, newTop);
      }
    }

    function closeDragElement() {
      console.log("Drag ended");
      // Stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
      document.ontouchend = null;
      document.ontouchmove = null;
    }
  };

  return (
    <>
      {isMobile ? (
        // Mobile: Draggable version with vanilla JS - NO TITLE, just video
        <div 
          ref={dragElementRef}
          className="fixed z-50 w-[110px] h-[110px] cursor-move drag-handle select-none touch-none"
          style={{ position: 'fixed', top: '100px', left: '10px' }}
        >
          {/* Just the video container - no title, minimal padding */}
          <div className="w-full h-full rounded-2xl shadow-2xl bg-gradient-to-r from-[var(--pfp-border-start)] via-[var(--pfp-border-middle)] to-[var(--pfp-border-end)] p-1">
            <div className="rounded-xl w-full h-full relative bg-gradient-to-b from-[var(--pfp-bg-start)] to-[var(--pfp-bg-end)] backdrop-blur-sm overflow-hidden">
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--pfp-overlay-start)] via-[var(--pfp-overlay-middle)] to-[var(--pfp-overlay-end)] pointer-events-none"></div>
              
              {/* Avatar - maintains video aspect ratio */}
              <div className="relative w-full z-10 h-full flex items-center justify-center pointer-events-none">
                <Pfp pfp={currentPfp} loop={shouldLoop} />
              </div>
            </div>
          </div>
          
          {/* Small drag indicator */}
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs opacity-60 pointer-events-auto">
            ⋮⋮
          </div>
        </div>
      ) : (
        // Desktop: Static version - WITH TITLE and full design
        <div className="w-full lg:col-span-1 h-full p-6 rounded-3xl shadow-2xl flex flex-col items-center bg-gradient-to-br from-[var(--panel-bg-start)] via-[var(--panel-bg-middle)] to-[var(--panel-bg-end)] border-2 border-[var(--panel-border)] backdrop-blur-sm relative overflow-hidden">
          {/* Floating decorative elements */}
          <div className="absolute top-12 left-6 text-lg animate-pulse">🌟</div>
          <div className="absolute bottom-24 right-4 text-sm animate-bounce">💖</div>
          <div className="absolute top-1/3 left-2 text-xs animate-pulse delay-500">✨</div>

          {/* Header - Desktop only */}
          <div className="mb-6 text-center relative z-10">
            <div className="inline-block p-3 bg-gradient-to-r from-[var(--panel-header-bg-start)] to-[var(--panel-header-bg-end)] rounded-2xl border border-[var(--panel-header-border)] backdrop-blur-sm">
              <h3 className="text-lg font-bold bg-gradient-to-r from-[var(--panel-header-text-start)] via-[var(--panel-header-text-middle)] to-[var(--panel-header-text-end)] bg-clip-text text-transparent">
                💖 Xiaolee 💖
              </h3>
            </div>
          </div>

          {/* Avatar Container */}
          <div className="w-full h-full flex-grow p-1 rounded-3xl shadow-2xl bg-gradient-to-r from-[var(--pfp-border-start)] via-[var(--pfp-border-middle)] to-[var(--pfp-border-end)]">
            <div className="rounded-[calc(1.5rem-4px)] w-full h-full relative bg-gradient-to-b from-[var(--pfp-bg-start)] to-[var(--pfp-bg-end)] backdrop-blur-sm overflow-hidden">
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--pfp-overlay-start)] via-[var(--pfp-overlay-middle)] to-[var(--pfp-overlay-end)]"></div>
              
              {/* Avatar */}
              <div className="relative w-full z-10 h-full flex items-center justify-center p-1">
                <Pfp pfp={currentPfp} loop={shouldLoop} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}