import React from 'react';

const SERVICE_CONFIG = {
  xray:     { label: "X-ray",         icon: "🔬", color: "blue"   },
  lab:      { label: "Lab", icon: "🧪", color: "green"  },
  pharmacy: { label: "ห้องยา",      icon: "💊", color: "amber"  },
  finance:  { label: "การเงิน",        icon: "💰", color: "purple" },
};

const COLOR_MAP = {
  blue:   { bar: "bg-blue-500",   bg: "bg-blue-50",   done: "text-blue-700",   wait: "text-orange-600" },
  green:  { bar: "bg-green-500",  bg: "bg-green-50",  done: "text-green-700",  wait: "text-orange-600" },
  amber:  { bar: "bg-amber-500",  bg: "bg-amber-50",  done: "text-amber-700",  wait: "text-orange-600" },
  purple: { bar: "bg-purple-500", bg: "bg-purple-50", done: "text-purple-700", wait: "text-orange-600" },
};

const ServiceItem = ({ serviceKey, data }) => {
  const cfg = SERVICE_CONFIG[serviceKey] || { label: serviceKey, icon: "🔧", color: "blue" };
  const col = COLOR_MAP[cfg.color];
  const { all = 0, finished = 0, waiting = 0 } = data;
  const pct = all > 0 ? Math.round((finished / all) * 100) : 0;

  return (
    <div className={`${col.bg} rounded-2xl p-4 border border-white/40`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{cfg.icon}</span>
        <p className="text-xl font-bold text-gray-600 uppercase tracking-tight">{cfg.label}</p>
      </div>
      <p className="text-3xl font-extrabold text-gray-800 mb-2">{all}</p>
      <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${col.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs font-semibold">
        <span className={col.done}>✓ {finished} เสร็จ</span>
        <span className={col.wait}>⏳ {waiting} รอ</span>
      </div>
    </div>
  );
};

export const TechnicalServicesCard = ({ data }) => {
  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-slate-50 to-gray-100 p-5 rounded-[28px] shadow-md border border-gray-200 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-3">
        <div className="w-2.5 h-7 bg-slate-500 rounded-full shadow-sm" />
        บริการเทคนิคการแพทย์
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(data).map(([key, val]) => (
          <ServiceItem key={key} serviceKey={key} data={val} />
        ))}
      </div>
    </div>
  );
};