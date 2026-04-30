import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// ─── Constants ────────────────────────────────────────────────────────────────
export const MATERIAL_COLORS = ["#020617", "#ff8f00", "#00897b", "#1e88e5", "#d81b60", "#f44336", "#9c27b0", "#3f51b5"];

/**
 * Common CSS Styles and Animations
 */
export const DashboardStyles = () => (
  <style>{`
    .glass { 
      background: rgba(255, 255, 255, 0.7); 
      backdrop-filter: blur(10px); 
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.4);
    }
    .soft-shadow { 
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); 
    }
    @keyframes fadeInUp { 
      from { opacity: 0; transform: translateY(20px); } 
      to { opacity: 1; transform: translateY(0); } 
    }
    .animate-fade-up { 
      animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in {
      animation: fadeIn 0.4s ease-out forwards;
    }
    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `}</style>
);

/**
 * MetricCard: Displays a single KPI with an icon
 */
export const MetricCard = ({ label, value, icon, color, onClick, isClickable }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 transition-all duration-200
      ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-200 hover:-translate-y-1' : ''}`}
    onClick={onClick}
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-gray-400 font-semibold truncate" title={label}>{label}</p>
      <p className="text-xl font-bold text-gray-800 truncate">{value ?? '—'}</p>
      {isClickable && <p className="text-[10px] text-blue-500 mt-0.5 font-medium">คลิกดูรายละเอียด</p>}
    </div>
  </div>
);

/**
 * GlassCard: A container with glassmorphism effects
 */
export const GlassCard = ({ children, className = "", noPadding = false }) => (
  <div className={`glass soft-shadow rounded-2xl ${noPadding ? '' : 'p-5 md:p-6 lg:p-8'} ${className}`}>
    {children}
  </div>
);

/**
 * SectionHeader: A consistent title block for dashboard sections
 */
export const SectionHeader = ({ title, icon, colorClass, subtitle }) => (
  <div className="mb-6">
    <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-10`}>
        <FontAwesomeIcon icon={icon} className={colorClass.replace('bg-', 'text-')} />
      </div>
      {title}
    </h2>
    {subtitle && <p className="text-xs text-gray-400 mt-1 ml-10">{subtitle}</p>}
  </div>
);
