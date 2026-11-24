import React from 'react';

export default function AdminHeader({ adminUser, liveRound, onLogout }) {
  return (
    <header className="h-16 bg-[#0f131d] border-b border-white/10 px-6 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(229,34,60,0.4)]">
          🛡️
        </div>
        <div>
          <h1 className="text-base font-black tracking-wide text-white uppercase" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
            Aviator Backoffice
          </h1>
          <span className="text-[10px] text-gray-400">Enterprise Risk Management & Financial Ledger</span>
        </div>
      </div>

      {/* Live Flight HUD Pill */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 bg-black/40 border border-white/10 px-3.5 py-1.5 rounded-xl">
          <span className={`w-2.5 h-2.5 rounded-full ${liveRound.state === 'FLYING' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
          <div className="text-xs">
            <span className="text-gray-400 mr-1.5">Round #{liveRound.roundNumber}:</span>
            <span className="font-bold text-white font-mono" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
              {liveRound.state} @ {liveRound.multiplier.toFixed(2)}x
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-right">
            <div className="text-white font-bold">{adminUser.username}</div>
            <div className="text-[9px] text-emerald-400 uppercase font-semibold">Super Admin</div>
          </div>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-gray-300 transition-all font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
