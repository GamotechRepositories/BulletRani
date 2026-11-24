import React from 'react';

export default function AdminSidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'overview', label: 'Financial Overview', icon: '📊' },
    { id: 'live_radar', label: 'Live Flight Radar', icon: '📡' },
    { id: 'players', label: 'Pilot Management', icon: '👥' },
    { id: 'settings', label: 'Risk & Math Config', icon: '⚙️' },
    { id: 'provider', label: 'Provider Integration', icon: '🔗' },
    { id: 'rounds', label: 'Provably Fair Ledger', icon: '📜' },
    { id: 'transactions', label: 'All Transactions', icon: '💳' }
  ];

  return (
    <aside className="w-64 bg-[#0a0d14] border-r border-white/10 p-4 flex flex-col justify-between shrink-0 select-none">
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">
          Platform Controls
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                isActive
                  ? 'bg-gradient-to-r from-red-600/20 to-rose-600/10 border border-red-500/30 text-white shadow-md'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[11px] text-gray-400">
        <div className="font-bold text-gray-300 mb-1">Aviator Engine v1.0</div>
        <div>WebSocket: <span className="text-emerald-400 font-mono">30Hz Active</span></div>
        <div>House Edge: <span className="text-amber-400 font-mono">3.0% (97% RTP)</span></div>
      </div>
    </aside>
  );
}
