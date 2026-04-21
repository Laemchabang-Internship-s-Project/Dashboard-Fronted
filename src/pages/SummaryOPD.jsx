import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGet, createEventSource } from "../services/api";
import { HeaderSkeleton, StatCardSkeleton } from '../components/Skeleton';

// --- Helper: แปลงนาทีเป็น ชม./นาที ---
function formatWaitTime(minutes) {
  if (minutes == null || isNaN(minutes) || minutes === 0) return "0 น.";
  if (minutes < 60) return `${Number(minutes).toFixed(1)} น.`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} ชม. ${mins} น.`;
}

// --- Helper: ตัวเลขวิ่ง ---
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

// --- คอมโพเนนต์รายแผนก (010, 062) ---
const DepartmentBlock = ({ title, stats, theme }) => {
  const isBlue = theme === 'blue';
  const containerBg = isBlue ? "bg-gradient-to-br from-blue-50 to-indigo-100" : "bg-gradient-to-br from-emerald-50 to-teal-100";
  const borderColor = isBlue ? "border-blue-200" : "border-emerald-200";
  const titleBarColor = isBlue ? "bg-blue-600" : "bg-emerald-600";
  const timeBoxText = isBlue ? "text-blue-900" : "text-emerald-900";

  return (
    <div className={`p-5 rounded-[28px] shadow-md border ${borderColor} mb-6 ${containerBg} relative overflow-hidden`}>
      <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-3">
        <div className={`w-2.5 h-7 ${titleBarColor} rounded-full shadow-sm`}></div>
        {title}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "ผู้รับบริการ OPD", val: stats.total },
          { label: "ซักประวัติ", val: stats.waitingScreening },
          { label: "รอตรวจ", val: stats.waitingExamCount },
          { label: "รอ Lab", val: stats.waitingLab },
          { label: "X-ray", val: stats.waitingXray },
        ].map((item, i) => (
          <div key={i} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl text-center shadow-sm border border-white/50">
            <p className="text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-tight leading-none">{item.label}</p>
            <AnimatedStat value={item.val} Component="p" className="text-2xl md:text-3xl font-extrabold text-gray-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "ระยะเวลารอคอย เฉลี่ยรวม", val: stats.avgTotal },
          { label: "ระยะเวลา รอซักประวัติ", val: stats.avgWaitScreening },
          { label: "ระยะเวลา รอพบแพทย์", val: stats.avgWaitExam },
          { label: "ระยะเวลา รอรับยา", val: stats.avgWaitDrug },
        ].map((item, i) => (
          <div key={i} className="bg-white/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center min-h-[90px] border border-white/20">
            <p className="text-[12px] font-semibold text-gray-600 mb-1.5">{item.label}</p>
            <p className={`text-xl font-black ${timeBoxText}`}>{item.val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`${isBlue ? 'bg-blue-200/50' : 'bg-emerald-200/50'} p-4 rounded-2xl text-center border border-white/40`}>
          <p className={`text-sm font-bold ${isBlue ? 'text-blue-800' : 'text-emerald-800'} mb-1`}>รอรับยา</p>
          <AnimatedStat value={stats.waitingDrug} className="text-3xl font-black text-gray-800" />
        </div>
        <div className="bg-orange-100/60 p-4 rounded-2xl text-center border border-white/40">
          <p className="text-sm font-bold text-orange-800 mb-1">รอจ่ายเงิน</p>
          <AnimatedStat value={stats.waitingPayment} className="text-3xl font-black text-gray-800" />
        </div>
        <div className="bg-purple-100/60 p-4 rounded-2xl text-center border border-white/40">
          <p className="text-sm font-bold text-purple-800 mb-1">กลับบ้าน</p>
          <AnimatedStat value={stats.goHome} className="text-3xl font-black text-gray-800" />
        </div>
      </div>
    </div>
  );
};

export default function OPDDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  // Filter States
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [secondaryState, setSecondaryState] = useState("normal"); // normal, filtered, hidden

  const [systemStats, setSystemStats] = useState({
    opdTotal: "-", walkIn: "-", telemed: "-", drugDelivery: "-"
  });

  const initialDepState = {
    total: 0, waitingScreening: 0, waitingExamCount: 0, waitingLab: 0, waitingXray: 0,
    avgTotal: "-", avgWaitScreening: "-", avgWaitExam: "-", avgWaitDrug: "-",
    waitingDrug: 0, waitingPayment: 0, goHome: 0
  };
  const [stats010, setStats010] = useState(initialDepState);
  const [stats062, setStats062] = useState(initialDepState);

  // --- Clock Effect ---
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Main Data Process ---
  const processData = (data) => {
    // บล็อกข้อมูล Real-time ไม่ให้มาทับยอดถ้ากำลังอยู่ในโหมด Filter
    if (!data || isFilterMode) return;

    const s = data.system;
    const rooms = data.opd_clinics?.rooms || [];

    setSystemStats({
      opdTotal: s?.total_OPD ?? "-",
      walkIn: s?.total_walkin ?? "-",
      telemed: s?.hos_telemed ?? "-",
      drugDelivery: s?.total_drug_delivery ?? "-"
    });

    const mapDept = (code) => {
      const room = rooms.find(r => r.room_code === code) || {};
      const depSum = data.summary?.[`dep_${code}`] || {};
      const deptSpecific = data.opd_clinics?.[`stats_${code}`] || {};

      return {
        total: room.total || 0,
        waitingScreening: room.waiting || 0,
        waitingExamCount: deptSpecific.waiting_exam || 0,
        waitingLab: deptSpecific.waiting_lab || 0,
        waitingXray: deptSpecific.waiting_xray || 0,
        avgTotal: formatWaitTime(depSum.avg_total),
        avgWaitScreening: formatWaitTime(depSum.avg_wait_screening),
        avgWaitExam: formatWaitTime(depSum.avg_wait_exam),
        avgWaitDrug: formatWaitTime(depSum.avg_wait_drug),
        waitingDrug: depSum.waiting_drug || 0,
        waitingPayment: depSum.waiting_payment || 0,
        goHome: room.finished || 0
      };
    };

    setStats010(mapDept("010"));
    setStats062(mapDept("062"));
  };

  // --- Filter Logic ---
  const applyDateFilter = async () => {
    if (!startDate || !endDate) return alert("กรุณาเลือกวันที่ให้ครบถ้วน");
    setIsFilterMode(true);
    setSecondaryState("filtered"); // ทำให้ส่วนล่างเป็นสีเทา
    setStatus({ text: "FILTERED (HISTORY)", color: "bg-purple-100 text-purple-700 font-bold" });
    try {
      const resp = await apiGet(`/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`);
      const data = resp.data;
      setSystemStats({
        opdTotal: data.opd_total || 0,
        walkIn: data.walk_in || 0,
        telemed: data.telemed || 0,
        drugDelivery: data.drug_delivery || 0
      });
      // เคลียร์ยอดแผนกให้เป็น "-" เพราะข้อมูลย้อนหลังปกติจะไม่มีส่วนนี้
      setStats010(initialDepState);
      setStats062(initialDepState);
    } catch (err) { console.error("Filter error:", err); }
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setSecondaryState("hidden");
    setTimeout(() => {
      setIsFilterMode(false);
      setSecondaryState("normal");

    }, 200);
  };

  useEffect(() => {
    let es = null;
    let isCancelled = false;

    const connectSSE = () => {
      if (isFilterMode || isCancelled) return;

      es = createEventSource("/api/dashboard/internal/stream");

      es.onopen = () => {
        if (isCancelled) { es.close(); return; }
        setStatus({ text: "LIVE", color: "bg-green-100 text-green-700 font-bold" });
      };

      es.onmessage = (e) => {
        if (isCancelled || isFilterMode) return;
        try {
          processData(JSON.parse(e.data));
        } catch (err) {
          console.error("Parse error:", err);
        }
      };

      es.onerror = () => {
        if (isFilterMode || isCancelled || !es) return;
        setStatus({ text: "RECONNECTING", color: "bg-orange-100 text-orange-700" });

        es.close();
        es = null;

        setTimeout(() => {
          if (!isFilterMode && !isCancelled) connectSSE();
        }, 3000);
      };
    };

    const loadInit = async () => {
      if (isFilterMode) return;
      try {
        const data = await apiGet("/api/dashboard/internal/snapshot");
        if (isCancelled) return;

        processData(data);
        setIsLoading(false);
        connectSSE();
      } catch (err) {
        console.error(err);
        setIsLoading(false);
        if (!isCancelled) connectSSE();
      }
    };

    if (!isFilterMode) {
      loadInit();
    }

    return () => {
      isCancelled = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [isFilterMode]);

  // CSS สำหรับ Grayscale และความโปร่งใส
  const secondaryClasses = `transition-all duration-300 ${secondaryState === "filtered" ? "opacity-30 grayscale pointer-events-none" :
      secondaryState === "hidden" ? "opacity-0" : "opacity-100"
    }`;



  // การ์ดแถวบน 4 ใบ
  const topCards = [
    { label: "ผู้รับบริการทั้งหมด (OPD Total)", val: stats.opdTotal, icon: <FontAwesomeIcon icon={faUsers} className="text-xl opacity-80" />, from: "#E0F2FE", to: "#BAE6FD", dark: false },
    { label: "Walk-in", val: stats.walkIn, icon: <FontAwesomeIcon icon={faWalking} className="text-xl opacity-80" />, from: "#FFEDD5", to: "#FED7AA", dark: false },
    { label: "Telemedicine", val: stats.telemed, icon: <FontAwesomeIcon icon={faLaptopMedical} className="text-xl opacity-80" />, from: "#DCFCE7", to: "#BBF7D0", dark: false },
    { label: "บริการส่งยา (Drug Delivery)", val: stats.drugDelivery, icon: <FontAwesomeIcon icon={faTruckMedical} className="text-xl opacity-80" />, from: "#F5F3FF", to: "#EDE9FE", dark: false },
  ];

  // การ์ดแถวกลาง 5 ใบ
  const midCards = [
    { label: "ผู้รับบริการ OPD", val: stats.customOpdTotal, from: "#75f7baff", to: "#D1FAE5" },
    { label: "ซักประวัติ", val: stats.waitingScreening, from: "#eed678ff", to: "#FEF3C7" },
    { label: "รอตรวจ", val: stats.waitingExam, from: "#fb8189ff", to: "#FFE4E6" },
    { label: "รอ Lab", val: stats.waitingLab, from: "#92bbf1ff", to: "#DBEAFE" },
    { label: "X-ray", val: stats.waitingXray, from: "#8b80f1ff", to: "#F1F5F9" },
  ];

  // การ์ดแถวล่าง 3 ใบ
  const botCards = [
    { label: "รอรับยา", val: stats.waitingPharmacy, from: "#95caedff", to: "#E0F2FE" },
    { label: "รอจ่ายเงิน", val: stats.waitingFinance, from: "#FEFCE8", to: "#FEF9C3" },
    { label: "กลับบ้าน", val: stats.goHome, from: "#F7FEE7", to: "#ECFCCB" },
  ];

  // เวลารอ 4 ช่อง
  const waitItems = [
    { label: "ระยะเวลารอคอย เฉลี่ยรวม", val: stats.avgWaitAll, from: "#F5F3FF", to: "#EDE9FE" },
    { label: "ระยะเวลา รอซักประวัติ", val: stats.avgWaitScreening, from: "#FDF2F8", to: "#FCE7F3" },
    { label: "ระยะเวลา รอพบแพทย์", val: stats.avgWaitExamTotal, from: "#ECFDF5", to: "#D1FAE5" },
    { label: "ระยะเวลา รอรับยา", val: stats.avgWaitPharmacy, from: "#FFF7ED", to: "#FFEDD5" },
  ];

  return (
    <div className="p-3 md:p-6 min-h-screen bg-[#f1f5f9]" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <Helmet><title>OPD Summary - LCBH</title></Helmet>

      <style>{`
        .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
        .stat-card { transition: all 0.25s ease; }
        .stat-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); }
      `}</style>

      <div className="max-w-7xl mx-auto">

        {/* ===== HEADER ===== */}
        <div className="flex flex-wrap justify-between items-start gap-3 mb-6 glass p-4 md:p-5 rounded-2xl soft-shadow border border-white/40">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">ภาพรวมระบบ</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-0" />
            <span className="text-gray-500 text-sm">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-0" />
            <button onClick={applyDateFilter}
              className="bg-[#1e40af] hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap">ค้นหา</button>
            <button onClick={clearDateFilter}
              className={`bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition ${!isFilterMode ? 'hidden' : ''}`}>ล้าง</button>
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap">
            <p className="text-gray-600 font-semibold text-sm hidden sm:block">{currentTime}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>{status.text}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6"><HeaderSkeleton /><StatCardSkeleton count={4} /></div>
        ) : (
          <>
            {/* Top 4 Global Cards */}
            <div className="rounded-[20px] p-[6px] mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-[6px]">
                <div className="stat-card bg-[#cbf4f9] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">ผู้รับบริการทั้งหมด</span>
                  </div>
                  <AnimatedStat value={systemStats.opdTotal} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-[#fef9a7] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6C14.1046 6 15 5.10457 15 4C15 2.89543 14.1046 2 13 2C11.8955 2 11 2.89543 11 4C11 5.10457 11.8955 6 13 6ZM11.0528 6.60557C11.3841 6.43992 11.7799 6.47097 12.0813 6.68627L13.0813 7.40056C13.3994 7.6278 13.5559 8.01959 13.482 8.40348L12.4332 13.847L16.8321 20.4453C17.1384 20.9048 17.0143 21.5257 16.5547 21.8321C16.0952 22.1384 15.4743 22.0142 15.168 21.5547L10.5416 14.6152L9.72611 13.3919C9.58336 13.1778 9.52866 12.9169 9.57338 12.6634L10.1699 9.28309L8.38464 10.1757L7.81282 13.0334C7.70445 13.575 7.17759 13.9261 6.63604 13.8178C6.09449 13.7094 5.74333 13.1825 5.85169 12.641L6.51947 9.30379C6.58001 9.00123 6.77684 8.74356 7.05282 8.60557L11.0528 6.60557ZM16.6838 12.9487L13.8093 11.9905L14.1909 10.0096L17.3163 11.0513C17.8402 11.226 18.1234 11.7923 17.9487 12.3162C17.7741 12.8402 17.2078 13.1234 16.6838 12.9487ZM6.12844 20.5097L9.39637 14.7001L9.70958 15.1699L10.641 16.5669L7.87159 21.4903C7.60083 21.9716 6.99111 22.1423 6.50976 21.8716C6.0284 21.6008 5.85768 20.9911 6.12844 20.5097Z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">Walk-in</span>
                  </div>
                  <AnimatedStat value={systemStats.walkIn} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-[#fcdab0] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">Telemedicine</span>
                  </div>
                  <AnimatedStat value={systemStats.telemed} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-[#d8cbf9] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M11.7905 5.25H8.4594L7.7094 7.5H3V18H6.02658C6.20854 19.2721 7.30257 20.25 8.625 20.25C9.94743 20.25 11.0415 19.2721 11.2234 18H13.5266C13.7085 19.2721 14.8026 20.25 16.125 20.25C17.4474 20.25 18.5415 19.2721 18.7234 18H21V13.0986L18.5563 11.4695L16.1746 7.5H12.5405L11.7905 5.25ZM10.9594 7.5L10.7094 6.75H9.54053L9.29053 7.5H10.9594ZM18.4974 16.5H19.5V13.9014L17.7729 12.75H12V9H4.5V16.5H6.25261C6.67391 15.6131 7.57785 15 8.625 15C9.67215 15 10.5761 15.6131 10.9974 16.5H13.7526C14.1739 15.6131 15.0779 15 16.125 15C17.1721 15 18.0761 15.6131 18.4974 16.5ZM15.3254 9L16.6754 11.25H13.5V9H15.3254ZM9.75 17.625C9.75 18.2463 9.24632 18.75 8.625 18.75C8.00368 18.75 7.5 18.2463 7.5 17.625C7.5 17.0037 8.00368 16.5 8.625 16.5C9.24632 16.5 9.75 17.0037 9.75 17.625ZM17.25 17.625C17.25 18.2463 16.7463 18.75 16.125 18.75C15.5037 18.75 15 18.2463 15 17.625C15 17.0037 15.5037 16.5 16.125 16.5C16.7463 16.5 17.25 17.0037 17.25 17.625ZM7.5 9.75V11.25H6V12.75H7.5V14.25H9V12.75H10.5V11.25H9V9.75H7.5Z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">บริการส่งยา (Drug Delivery)</span>
                  </div>
                  <AnimatedStat value={systemStats.drugDelivery} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
              </div>
            </div>

            {/* Department Blocks - จะกลายเป็นสีเทาเมื่อ Filter */}
            <div className={secondaryClasses}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DepartmentBlock
                  title="010 ผู้รับบริการ OPD (ทั่วไป)"
                  stats={stats010}
                  theme="blue"
                />
                <DepartmentBlock
                  title="062 ผู้รับบริการ OPD (นัด)"
                  stats={stats062}
                  theme="emerald"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}