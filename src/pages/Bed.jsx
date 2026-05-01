import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGetInternal } from "../services/api";
import { DashboardHeader } from '../components/DashboardUI';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { DashboardStyles } from '../components/DashboardUI';
import { LiveClock } from '../components/ChartComponents';

const AnimatedStat = ({ value, suffix = "", className = "" }) => {
  const [display, setDisplay] = useState("-");
  const frameRef = useRef(null);

  useEffect(() => {
    if (value === "-" || value == null || isNaN(value)) {
      setDisplay(value || "-");
      return;
    }
    const target = parseFloat(value);
    let current = parseFloat(display) || 0;
    if (current === target) { setDisplay(target); return; }

    const delta = (target - current) / 15;
    cancelAnimationFrame(frameRef.current);
    function step() {
      current += delta;
      const done = delta > 0 ? current >= target : current <= target;
      setDisplay(done ? target : Math.round(current));
      if (!done) frameRef.current = requestAnimationFrame(step);
    }
    step();
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <span className={className}>{display}{suffix}</span>;
};

export default function BedDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState({ text: "Connecting...", type: "neutral" });
  const [bedData, setBedData] = useState({ total: 0, available: 0, occupied: 0, other: 0, by_ward: {} });
  const [selectedWard, setSelectedWard] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('th-TH', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchBedData = async () => {
    try {
      const response = await apiGetInternal("/api/beds/summary");
      if (response?.data) {
        const data = response.data;
        const FIXED_WARD = "ผู้ป่วยอายุรกรรมหญิง";
        const FIXED_TOTAL = 30;
        const newByWard = { ...data.by_ward };

        if (newByWard[FIXED_WARD]) {
          const w = newByWard[FIXED_WARD];
          newByWard[FIXED_WARD] = {
            ...w,
            total: FIXED_TOTAL,
            available: Math.max(0, FIXED_TOTAL - w.occupied),
          };
        }

        const totals = Object.values(newByWard).reduce(
          (acc, w) => {
            acc.total += w.total || 0;
            acc.available += w.available || 0;
            acc.occupied += w.occupied || 0;
            acc.other += w.other || 0;
            return acc;
          },
          { total: 0, available: 0, occupied: 0, other: 0 }
        );

        setBedData({ ...data, ...totals, by_ward: newByWard });
        setStatus({ text: "LIVE", type: "success" });
      }
    } catch (error) {
      console.error("Error fetching bed summary:", error);
      setStatus({ text: "ERROR", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBedData();
    const poll = setInterval(fetchBedData, 30000);
    return () => clearInterval(poll);
  }, []);

  const wardEntries = Object.entries(bedData.by_ward || {});
  const filteredWards = selectedWard === "all"
    ? wardEntries
    : wardEntries.filter(([name]) => name === selectedWard);

  const occupancyRate = bedData.total > 0
    ? Math.round((bedData.occupied / bedData.total) * 100)
    : 0;

  const statusStyles = {
    success: "bg-green-50 text-green-700 border border-green-200",
    error: "bg-red-50 text-red-700 border border-red-200",
    neutral: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  // 1. เพิ่ม state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 2. เพิ่ม handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBedData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Bed Summary - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-5 pb-20">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <FontAwesomeIcon icon={faBed} className="text-blue-500" />
              Bed Summary Dashboard
            </h1>
            <p className="text-gray-400 text-sm mt-1">ภาพรวมเตียงผู้ป่วยใน</p>
          </div>
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl hover:bg-white hover:text-blue-500 hover:border-blue-200 hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* Ward picker */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white/50 border border-gray-200 rounded-xl px-4 py-2 text-[13px] text-gray-700 shadow-sm hover:bg-white transition-colors flex items-center gap-2 max-w-[200px]"
            >
              <span className="truncate">{selectedWard === "all" ? "ดูทั้งหมด" : selectedWard}</span>
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="flex flex-col items-end whitespace-nowrap"><LiveClock /></div>
            <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${status.type === 'success' ? 'bg-green-100 text-green-700' :
              status.type === 'error' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-500'
              }`}>
              {status.text}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">เตียงทั้งหมด</span>
                <AnimatedStat value={150} className="text-[30px] font-semibold leading-none text-blue-600" />
                <span className="text-[11px] text-gray-300">Total beds</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">จ่ายเตียงแล้ว</span>
                <AnimatedStat value={bedData.occupied} className="text-[30px] font-semibold leading-none text-rose-500" />
                <span className="text-[11px] text-gray-300">Occupied</span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-1 bg-rose-400 rounded-full transition-all duration-700" style={{ width: `${Math.round((bedData.occupied / bedData.total) * 100)}%` }} />
                </div>
              </div>

              {/* <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">เตียงว่าง</span>
                <AnimatedStat value={bedData.available} className="text-[30px] font-semibold leading-none text-emerald-500" />
                <span className="text-[11px] text-gray-300">Available</span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-1 bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${Math.round((bedData.available / bedData.total) * 100)}%` }} />
                </div>
              </div> */}

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">อัตราครองเตียง</span>
                <AnimatedStat value={occupancyRate} suffix="%" className="text-[30px] font-semibold leading-none text-amber-500" />
                <span className="text-[11px] text-gray-300">Occupancy rate</span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-1 bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${occupancyRate}%` }} />
                </div>
              </div>
            </div>

            {/* Ward Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-[14px] bg-blue-600 rounded-full" />
                <h2 className="text-[13px] font-medium text-gray-500">แยกตามหอผู้ป่วย</h2>
              </div>

              {filteredWards.length === 0 ? (
                <div className="text-center py-16 text-gray-300 text-sm">ไม่พบข้อมูลหอผู้ป่วย</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredWards.map(([wardName, stats]) => {
                    const wardRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
                    const rateColor = wardRate >= 90 ? "text-rose-600" : wardRate >= 70 ? "text-amber-500" : "text-emerald-500";
                    const barColor = wardRate >= 90 ? "bg-rose-400" : wardRate >= 70 ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div key={wardName} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-gray-200 transition-colors">
                        <p className="text-[15px] font-medium text-gray-800 mb-3 leading-snug line-clamp-2 min-h-[38px]" title={wardName}>
                          {wardName}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-blue-50 rounded-xl px-2 py-2 text-center">
                            <p className="text-[17px] font-semibold text-blue-700 leading-none">{stats.total}</p>
                            <p className="text-[10px] text-blue-400 mt-1">ทั้งหมด</p>
                          </div>
                          <div className="bg-rose-50 rounded-xl px-2 py-2 text-center">
                            <p className={`text-[17px] font-semibold leading-none `}>{wardRate}%</p>
                            <p className="text-[10px] text-rose-300 mt-1">อัตราครองเตียง</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl px-2 py-2 text-center">
                            <p className="text-[17px] font-semibold text-emerald-600 leading-none">{stats.available}</p>
                            <p className="text-[10px] text-emerald-400 mt-1">คงเหลือ</p>
                          </div>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-1 rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${wardRate}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          style={{ fontFamily: "'Sarabun', sans-serif" }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-[16px] font-semibold text-gray-800">เลือกหอผู้ป่วย (Ward)</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              <button
                onClick={() => { setSelectedWard("all"); setIsModalOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all ${selectedWard === "all"
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-100"
                  : "hover:bg-gray-50 text-gray-700 border border-transparent"
                  }`}
              >
                ทั้งหมด
              </button>
              {wardEntries.map(([name]) => (
                <button
                  key={name}
                  onClick={() => { setSelectedWard(name); setIsModalOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all ${selectedWard === name
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-100"
                    : "hover:bg-gray-50 text-gray-700 border border-transparent"
                    }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}