import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { LiveClock } from './ChartComponents';

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

/**
 * DashboardHeader: Top header with title, subtitle, refresh button, and clock
 * Supports optional children in the center for filters.
 */
export const DashboardHeader = ({ title, subtitle, icon, iconColorClass = "text-blue-500", statusColorClass = "bg-green-100 text-green-700", statusText = "LIVE", isRefreshing, onRefresh, children }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 glass p-4 md:p-5 rounded-2xl soft-shadow border border-white/40">
    
    {/* ส่วนที่ 1: หัวข้อ */}
    <div className={`flex-shrink-0 ${children ? 'md:w-[320px]' : 'flex-1'}`}>
      <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
        {icon && <FontAwesomeIcon icon={icon} className={iconColorClass} />}
        {title}
      </h1>
      <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
    </div>

    {/* ส่วนที่ 2: Filter (Optional) */}
    {children && (
      <div className="flex-1 flex justify-center w-full md:w-auto">
        {children}
      </div>
    )}

    {/* ส่วนที่ 3: เวลา และสถานะ */}
    <div className={`flex items-center justify-end gap-3 flex-shrink-0 ${children ? 'md:w-[320px]' : ''}`}>
      {onRefresh && (
        <button onClick={onRefresh} disabled={isRefreshing} className="p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl hover:bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95">
          <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
        </button>
      )}
      <div className="flex flex-col items-end whitespace-nowrap"><LiveClock /></div>
      <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${statusColorClass} animate-pulse`}>{statusText}</span>
    </div>
  </div>
);

/**
 * ErrorMessage: Standardized error banner
 */
export const ErrorMessage = ({ error }) => {
  if (!error) return null;
  return (
    <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-6 shadow-sm animate-fade-in">
      {error}
    </div>
  );
};

/**
 * GraphTabs: Reusable tabs for switching between graphs
 * @param {Array} tabs - Array of { key, label, icon, activeColor }
 * @param {string} activeTab - Currently active tab key
 * @param {function} onTabChange - Callback when a tab is clicked
 */
export const GraphTabs = ({ tabs, activeTab, onTabChange }) => (
  <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
    <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    {tabs.map(tab => {
      const isActive = activeTab === tab.key;
      return (
        <button 
          key={tab.key} 
          onClick={() => onTabChange(tab.key)} 
          className={`flex-1 lg:flex-none whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 
            ${isActive ? 'bg-white shadow-sm ' + (tab.activeColor || 'text-blue-600') : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
        >
          {tab.icon && <FontAwesomeIcon icon={tab.icon} className="mr-2" />}
          {tab.label}
        </button>
      );
    })}
  </div>
);
