import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGetInternal } from "../services/api";

// --- Helper: ตัวเลขวิ่ง (นำมาจากหน้าเดิม) ---
const AnimatedStat = ({ value, Component = "h2", className = "" }) => {
  const [displayValue, setDisplayValue] = useState("-");
  const ref = useRef(null);

  useEffect(() => {
    if (value === "-" || value == null || isNaN(value)) {
      setDisplayValue(value || "-");
      return;
    }
    const newValue = parseFloat(value);
    const oldValue = parseFloat(displayValue) || 0;
    if (oldValue === newValue) { setDisplayValue(newValue); return; }

    let start = oldValue;
    const duration = 300;
    const step = (newValue - start) / (duration / 16);
    let animationFrame;
    function update() {
      start += step;
      if ((step > 0 && start >= newValue) || (step < 0 && start <= newValue)) {
        setDisplayValue(newValue);
      } else {
        setDisplayValue(Math.round(start));
        animationFrame = requestAnimationFrame(update);
      }
    }
    update();
    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <Component ref={ref} className={className}>{displayValue}</Component>;
};

export default function BedDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  const [bedData, setBedData] = useState({
    total: "-", available: "-", occupied: "-", other: "-", by_ward: {}
  });

  const [selectedWard, setSelectedWard] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchBedData = async () => {
    try {
      const response = await apiGetInternal("/api/beds/summary");

      if (response && response.data) {
        const data = response.data;

        const FIXED_WARD = "ผู้ป่วยอายุรกรรมหญิง";
        const FIXED_TOTAL = 30;

        // clone ward data
        const newByWard = { ...data.by_ward };

        // 👉 fix ward เป้าหมาย
        if (newByWard[FIXED_WARD]) {
          const w = newByWard[FIXED_WARD];

          const newAvailable = Math.max(0, FIXED_TOTAL - w.occupied);

          newByWard[FIXED_WARD] = {
            ...w,
            total: FIXED_TOTAL,
            available: newAvailable,
          };
        }

        // 👉 คำนวณ global ใหม่
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

        // 👉 set state ครั้งเดียว (สำคัญ)
        setBedData({
          ...data,
          ...totals,
          by_ward: newByWard,
        });

        setStatus({
          text: "UPDATED",
          color: "bg-green-100 text-green-700 font-bold",
        });
      }
    } catch (error) {
      console.error("Error fetching bed summary:", error);
      setStatus({
        text: "ERROR",
        color: "bg-red-100 text-red-700 font-bold",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBedData();
    const pollInterval = setInterval(fetchBedData, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  const wardEntries = Object.entries(bedData.by_ward || {});
  const filteredWards = selectedWard === "all"
    ? wardEntries
    : wardEntries.filter(([wardName]) => wardName === selectedWard);

  // คำนวณ % ภาพรวม
  const globalOccupancyRate = (bedData.total > 0)
    ? Math.round((bedData.occupied / bedData.total) * 100)
    : 0;
  return (
    <div className="p-3 md:p-6 min-h-screen bg-[#f1f5f9] relative" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <Helmet><title>Bed Summary - LCBH</title></Helmet>

      <style>{`
        .stat-card { transition: all 0.25s ease; }
        .stat-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
        .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 glass p-4 md:p-5 rounded-2xl soft-shadow border border-white/40">
          <div className="flex-shrink-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">ภาพรวมเตียงผู้ป่วยใน (IPD)</h1>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-full md:w-64 text-left flex justify-between items-center"
            >
              <span className="truncate mr-2">
                {selectedWard === 'all' ? 'ดูทั้งหมด' : selectedWard}
              </span>
              <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            <div className="flex items-center gap-2 whitespace-nowrap justify-between md:justify-start">
              <p className="text-gray-600 font-semibold text-[11px] md:text-sm">{currentTime || "--:--:--"}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>
                {status.text}
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e40af]"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[6px] md:gap-4 mb-8">
              <div className="stat-card bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] border border-blue-200">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <span className="text-xs md:text-sm font-medium">เตียงทั้งหมด (Total)</span>
                </div>
                <AnimatedStat value={150} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto text-blue-900" />
              </div>

              <div className="stat-card bg-gradient-to-br from-[#FFE4E6] to-[#FDA4AF] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] border border-rose-200">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <span className="text-xs md:text-sm font-medium text-rose-800">จ่ายเตียงแล้ว (Occupied)</span>
                </div>
                <div className="flex items-baseline gap-1 mt-auto">
                  <AnimatedStat value={bedData.occupied} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold text-rose-700" />

                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-4 pl-2 border-l-4 border-[#1e40af]">แยกตามหอผู้ป่วย (Ward)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWards.map(([wardName, stats]) => (
                <div key={wardName} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col h-full">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 line-clamp-1" title={wardName}>{wardName}</h3>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 p-2 rounded-lg text-center">
                      <p className="text-[10px] font-bold text-blue-600 mb-1">ทั้งหมด</p>
                      <p className="text-lg font-black text-blue-900">{stats.total}</p>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg text-center border border-rose-100">
                      <p className="text-[10px] font-bold text-rose-600 mb-1">อัตราครองเตียง</p>
                      <p className="text-lg font-black text-rose-700">
                        {stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0}%
                      </p>
                    </div>
                    <div className="bg-green-50 p-2 rounded-lg text-center border border-green-100">
                      <p className="text-[10px] font-bold text-green-600 mb-1">คงเหลือ</p>
                      <p className="text-lg font-black text-green-700">{stats.available}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Dropdown */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" style={{ fontFamily: "'Sarabun', sans-serif" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">เลือกหอผู้ป่วย (Ward)</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 focus:outline-none transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              <button
                onClick={() => { setSelectedWard('all'); setIsModalOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedWard === 'all' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100' : 'hover:bg-gray-50 text-gray-700 border border-transparent'}`}
              >
                ทั้งหมด
              </button>
              {wardEntries.map(([name]) => (
                <button
                  key={name}
                  onClick={() => { setSelectedWard(name); setIsModalOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedWard === name ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100' : 'hover:bg-gray-50 text-gray-700 border border-transparent'}`}
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