import React, { useRef, useState } from 'react';
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconWallet,
  IconPlus
} from './Icons';

function CheckeredLogo() {
  return (
    <div className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
      <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-white/15">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #111 25%, transparent 25%), linear-gradient(-45deg, #111 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #111 75%), linear-gradient(-45deg, transparent 75%, #111 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
            backgroundColor: '#d4d4d4'
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <span className="font-black text-white/90 text-xs sm:text-sm tracking-tighter">ax</span>
        </div>
      </div>
      <div className="leading-none hidden md:block">
        <div className="font-black text-white text-base tracking-tight">
          Riksha<span className="text-gray-300">X</span>
        </div>
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.18em] mt-0.5">
          Crash Race
        </div>
      </div>
    </div>
  );
}

export default function TopGunHeader({
  history,
  username = 'TopGunPilot',
  balance = 5895.75,
  onOpenWallet,
  onSelectRound,
  onOpenProfile
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const scrollerRef = useRef(null);

  const defaultMultipliers = [
    { m: 1.25, isHigh: false },
    { m: 3.12, isHigh: false },
    { m: 45.99, isHigh: true },
    { m: 3.04, isHigh: false },
    { m: 1.18, isHigh: false },
    { m: 1.57, isHigh: false },
    { m: 1.45, isHigh: false },
    { m: 1.57, isHigh: false },
    { m: 2.83, isHigh: false },
    { m: 1.40, isHigh: false },
    { m: 1.79, isHigh: false },
    { m: 6.11, isHigh: false },
    { m: 1.54, isHigh: false },
    { m: 3.01, isHigh: false },
    { m: 15.74, isHigh: true },
    { m: 23.63, isHigh: true }
  ];

  const displayList = (history && history.length > 0)
    ? history.slice(-25).reverse().map(r => {
        const m = r.crash_multiplier || r.crashMultiplier || 1.0;
        return {
          m: parseFloat(m.toFixed(2)),
          isHigh: m >= 10.0,
          round: r
        };
      })
    : defaultMultipliers;

  const scrollRibbon = (dir) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: dir * 120, behavior: 'smooth' });
  };

  const shortBalance = balance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <header className="w-full bg-[#0d0f12]/95 border-b border-white/[0.06] px-2 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 select-none z-30 shrink-0 safe-top">
      <CheckeredLogo />

      <div className="relative flex-1 min-w-0 max-w-3xl mx-0.5 sm:mx-2">
        <div className="flex items-center gap-0.5 sm:gap-1.5 bg-[#14161a]/95 border border-white/[0.08] rounded-full px-1 sm:px-1.5 py-0.5 sm:py-1">
          <button
            onClick={() => scrollRibbon(-1)}
            className="hidden sm:flex w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 items-center justify-center shrink-0 cursor-pointer"
            aria-label="Scroll left"
          >
            <IconChevronLeft className="w-3 h-3" />
          </button>

          <div className="hidden lg:flex flex-col items-start pr-1 shrink-0 border-r border-white/10 mr-1">
            <span className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider leading-none">Recent</span>
            <span className="text-[8px] font-extrabold text-gray-500 uppercase tracking-wider leading-none mt-0.5">Multipliers</span>
          </div>

          <div
            ref={scrollerRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 flex-1 text-[10px] sm:text-xs font-mono font-bold touch-pan-x"
          >
            {displayList.map((item, idx) => (
              <span
                key={idx}
                onClick={() => item.round && onSelectRound && onSelectRound(item.round)}
                className={`cursor-pointer shrink-0 whitespace-nowrap ${
                  item.isHigh
                    ? 'text-[#c084fc] font-semibold'
                    : 'text-gray-400 font-semibold'
                }`}
              >
                x{item.m.toFixed(2)}
              </span>
            ))}
          </div>

          <button
            onClick={() => scrollRibbon(1)}
            className="hidden sm:flex w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 items-center justify-center shrink-0 cursor-pointer"
            aria-label="Scroll right"
          >
            <IconChevronRight className="w-3 h-3" />
          </button>

          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-6 h-6 rounded-full hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="History"
          >
            <IconChevronDown className="w-3 h-3" />
          </button>
        </div>

        {dropdownOpen && (
          <div className="absolute top-9 left-0 right-0 sm:right-auto sm:w-80 bg-[#14161a] border border-white/10 rounded-xl shadow-2xl p-3 z-50 animate-fade-in text-xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">Past Multipliers</span>
              <button onClick={() => setDropdownOpen(false)} className="text-gray-400 hover:text-white px-1 cursor-pointer">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
              {displayList.map((item, idx) => (
                <div
                  key={idx}
                  className={`text-center py-1 rounded bg-black/40 font-mono text-[11px] font-bold ${
                    item.isHigh ? 'text-[#c084fc]' : 'text-gray-400'
                  }`}
                >
                  x{item.m.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <button
          onClick={onOpenWallet}
          className="flex items-center gap-1 sm:gap-2 bg-[#14161a] border border-white/10 rounded-full pl-1.5 sm:pl-2.5 pr-1 py-1 cursor-pointer"
        >
          <IconWallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
          <span className="font-extrabold text-white text-[10px] sm:text-sm font-mono tracking-tight max-w-[72px] sm:max-w-none truncate">
            ₹{shortBalance}
          </span>
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#28a700] text-white flex items-center justify-center">
            <IconPlus className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
          </span>
        </button>

        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1 bg-[#14161a] border border-white/10 rounded-full p-0.5 sm:pl-1 sm:pr-2 sm:py-1 cursor-pointer"
          aria-label={username}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-white/15 bg-black/60">
            <img src="/bike.png" alt="" className="w-full h-full object-cover scale-150" />
          </div>
          <IconChevronDown className="hidden sm:block w-3 h-3 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
