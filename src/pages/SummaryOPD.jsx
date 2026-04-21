import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faWalking, faLaptopMedical, faTruckMedical } from '@fortawesome/free-solid-svg-icons';
import { Helmet } from "react-helmet-async";
import { apiGet, createEventSource } from "../services/api";
import { HeaderSkeleton, StatCardSkeleton, WaitTimeSkeleton } from '../components/Skeleton';


function formatWaitTime(minutes) {
  if (minutes == null || isNaN(minutes)) return "-";
  if (minutes < 60) return Number(minutes).toFixed(1);

  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} ชม. ${mins}`;
}

// คอมโพเนนต์นี้ทำหน้าที่แทนฟังก์ชัน animateValue() และเอฟเฟกต์ flash ในโค้ดเดิม
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

    if (oldValue === newValue) {
      setDisplayValue(newValue);
      return;
    }

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

    // flash effect
    if (ref.current) {
      ref.current.classList.add('flash');
      setTimeout(() => {
        if (ref.current) ref.current.classList.remove('flash');
      }, 400);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [value]);

  return <Component ref={ref} className={className}>{displayValue}</Component>;
};

export default function OPDDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  // Filter states
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [secondaryState, setSecondaryState] = useState("normal"); // normal, filtered, hidden

  // Data states
  const [stats, setStats] = useState({
    opdTotal: "-", walkIn: "-", telemed: "-", drugDelivery: "-",
    customOpdTotal: "-", waitingScreening: "-", waitingExam: "-", waitingLab: "-", waitingXray: "-",
    waitingPharmacy: "-", waitingFinance: "-", goHome: "-",
    avgWaitScreening: "-", avgWaitExamTotal: "-", avgWaitPharmacy: "-", avgWaitAll: "-"
  });

  // อัปเดตเวลาปัจจุบัน
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      };
      setCurrentTime(now.toLocaleString('th-TH', options));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateDashboardData = (data) => {
    // ป้องกันข้อมูล Real-time มาเขียนทับข้อมูล Filter
    if (!data?.opd_clinics || isFilterMode) return;

    const h = data.opd_clinics.header;
    const s = data.system;
    const rooms = data.opd_clinics.rooms || [];
    const room010 = rooms.find(r => r.room_code === '010');

    const waitScreening = room010?.avg_wait_minutes || 0;
    const waitExam = data.summary?.avg_wait_examination || 0;
    const waitPharmacy = data?.technical_services?.pharmacy?.avg_wait_minutes || 0;
    const totalAvgWait = waitScreening + waitExam + waitPharmacy;

    setStats(prev => ({
      ...prev,
      opdTotal: s?.total_OPD ?? 0,
      walkIn: s?.total_walkin ?? 0,
      telemed: s?.hos_telemed ?? 0,
      drugDelivery: s?.total_drug_delivery ?? 0,
      customOpdTotal: h?.custom_opd_total ?? 0,
      waitingScreening: h?.waiting_screening ?? 0,
      waitingExam: h?.waiting_exam ?? 0,
      waitingLab: data?.technical_services?.lab?.waiting ?? 0,
      waitingXray: data?.technical_services?.xray?.waiting ?? 0,
      waitingPharmacy: data?.technical_services?.pharmacy?.waiting ?? 0,
      waitingFinance: data?.technical_services?.finance?.waiting ?? 0,
      goHome: s?.hos_go_home ?? 0,
      avgWaitScreening: formatWaitTime(waitScreening),
      avgWaitExamTotal: formatWaitTime(waitExam),
      avgWaitPharmacy: formatWaitTime(waitPharmacy),
      avgWaitAll: formatWaitTime(totalAvgWait),
    }));
  };

  // จัดการ SSE และ Snapshot
  useEffect(() => {
    let es = null;
    let isCancelled = false; // สำหรับเช็คว่า Effect นี้ยัง Valid อยู่หรือไม่

    const connectSSE = () => {
      if (isFilterMode || isCancelled) return;
      console.log("📡 [2/2] Connecting to SSE Stream...");

      es = createEventSource("/api/dashboard/internal/stream");

      es.onopen = () => {
        if (isCancelled) { es.close(); return; }
        console.log("🟢 SSE Connection Established");
        setStatus({ text: "LIVE", color: "bg-green-100 text-green-700 font-bold" });
      };

      es.onmessage = (event) => {
        if (isCancelled || isFilterMode) return;
        try {
          const data = JSON.parse(event.data);
          updateDashboardData(data);
        } catch (e) {
          console.error("❌ JSON parse error:", e);
        }
      };

      es.onerror = () => {
        if (isFilterMode || isCancelled || !es) return;
        console.error("🔴 SSE Connection Lost");
        setStatus({ text: "RECONNECTING", color: "bg-orange-100 text-orange-700" });

        es.close();
        es = null;

        setTimeout(() => {
          if (!isFilterMode && !isCancelled) connectSSE();
        }, 3000);
      };
    };

    const loadSnapshot = async () => {
      if (isFilterMode) return;
      console.log("📦 [1/2] Loading Snapshot data...");
      try {
        const data = await apiGet("/api/dashboard/internal/snapshot");

        if (isCancelled) return; // ถ้าเปลี่ยนโหมดไปแล้ว ไม่ต้องทำต่อ

        console.log("✅ Snapshot Loaded Successfully");
        updateDashboardData(data);
        setIsLoading(false);
        connectSSE();
      } catch (err) {
        console.error("❌ Snapshot error:", err);
        setIsLoading(false);
        if (!isCancelled) connectSSE();
      }
    };

    if (!isFilterMode) {
      loadSnapshot();
    }

    return () => {
      isCancelled = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [isFilterMode]);

  const applyDateFilter = async () => {
    if (!startDate || !endDate) {
      alert('กรุณาเลือกวันที่ให้ครบถ้วน');
      return;
    }

    setIsFilterMode(true);
    setSecondaryState("filtered");
    setStatus({ text: "FILTERED (HISTORY)", color: "bg-purple-100 text-purple-700 font-bold" });

    try {
      const responseData = await apiGet(`/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`);
      const data = responseData.data;

      setStats(prev => ({
        ...prev,
        opdTotal: data.opd_total ?? 0,
        walkIn: data.walk_in ?? 0,
        telemed: data.telemed ?? 0,
        drugDelivery: data.drug_delivery ?? 0
      }));
    } catch (err) {
      console.error("❌ Filter fetch error:", err);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลย้อนหลัง");
    }
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setSecondaryState("hidden");
    setStatus({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

    setTimeout(() => {
      setIsFilterMode(false);
      setSecondaryState("normal");
    }, 200);
  };

  // CSS classes สำหรับ secondary content
  const secondaryClasses = `transition-all duration-300 ${secondaryState === "filtered" ? "opacity-30 grayscale pointer-events-none" :
    secondaryState === "hidden" ? "opacity-0" : "opacity-100"
    }`;

  return (
    <>
      <Helmet>
        <title>OPD Summary - LCBH</title>
      </Helmet>
      <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"}}>
        <style>{`
                .stat-card { transition: all 0.25s ease; }
                .stat-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); }
                .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
                .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
                .flash { animation: flash 0.4s ease; }
                @keyframes flash {
                    0% { background-color: transparent; }
                    100% { background-color: transparent; }
                }
            `}</style>

        <div className="max-w-7xl mx-auto">

          {/* ===== SKELETON LOADING ===== */}
          {isLoading ? (
            <div className="space-y-6">
              <HeaderSkeleton />
              <StatCardSkeleton count={4} />
              <StatCardSkeleton count={5} />
              <WaitTimeSkeleton />
            </div>
          ) : (
            <>

          <div className="flex flex-wrap justify-between items-center gap-3 mb-6 glass p-4 md:p-5 rounded-2xl soft-shadow border border-white/40">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">การให้บริการต่าง ๆ</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-0" />
              <span className="text-gray-500 text-sm">-</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-0" />
              <button onClick={applyDateFilter}
                className="bg-[#c2c1ea] hover:bg-[#a6a5d4] text-[#1e293b] text-sm px-4 py-1.5 rounded transition shadow-sm font-medium whitespace-nowrap">ค้นหา</button>
              <button onClick={clearDateFilter}
                className={`bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition ${!isFilterMode ? 'hidden' : ''}`}>ล้าง</button>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <p className="text-gray-600 font-semibold text-sm hidden sm:block">{currentTime}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>{status.text}</span>
            </div>
          </div>

          {/* กรอบสีดำล้อมรอบการ์ดแถวบน */}
          <div className="rounded-[20px] p-[6px] mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[6px]">
              {/* Card 1 */}
              <div className="stat-card bg-[#cbf4f9] text-[#1e293b] p-5 rounded-[14px] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span className="text-sm font-medium">ผู้รับบริการทั้งหมด (OPD Total)</span>
                </div>
                <AnimatedStat value={stats.opdTotal} Component="h2" className="text-[1.8rem] md:text-[2.8rem] font-bold mt-auto" />
              </div>

              {/* Card 2 */}
              <div className="stat-card bg-[#fef9a7] text-[#1e293b] p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M13 6C14.1046 6 15 5.10457 15 4C15 2.89543 14.1046 2 13 2C11.8955 2 11 2.89543 11 4C11 5.10457 11.8955 6 13 6ZM11.0528 6.60557C11.3841 6.43992 11.7799 6.47097 12.0813 6.68627L13.0813 7.40056C13.3994 7.6278 13.5559 8.01959 13.482 8.40348L12.4332 13.847L16.8321 20.4453C17.1384 20.9048 17.0143 21.5257 16.5547 21.8321C16.0952 22.1384 15.4743 22.0142 15.168 21.5547L10.5416 14.6152L9.72611 13.3919C9.58336 13.1778 9.52866 12.9169 9.57338 12.6634L10.1699 9.28309L8.38464 10.1757L7.81282 13.0334C7.70445 13.575 7.17759 13.9261 6.63604 13.8178C6.09449 13.7094 5.74333 13.1825 5.85169 12.641L6.51947 9.30379C6.58001 9.00123 6.77684 8.74356 7.05282 8.60557L11.0528 6.60557ZM16.6838 12.9487L13.8093 11.9905L14.1909 10.0096L17.3163 11.0513C17.8402 11.226 18.1234 11.7923 17.9487 12.3162C17.7741 12.8402 17.2078 13.1234 16.6838 12.9487ZM6.12844 20.5097L9.39637 14.7001L9.70958 15.1699L10.641 16.5669L7.87159 21.4903C7.60083 21.9716 6.99111 22.1423 6.50976 21.8716C6.0284 21.6008 5.85768 20.9911 6.12844 20.5097Z"></path>
                  </svg>
                  <span className="text-sm font-medium">Walk-in</span>
                </div>
                <AnimatedStat value={stats.walkIn} Component="h2" className="text-[1.8rem] md:text-[2.8rem] font-bold mt-auto" />
              </div>

              {/* Card 3 */}
              <div className="stat-card bg-[#fcdab0] text-[#1e293b] p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  <span className="text-sm font-medium">Telemedicine</span>
                </div>
                <AnimatedStat value={stats.telemed} Component="h2" className="text-[1.8rem] md:text-[2.8rem] font-bold mt-auto" />
              </div>

              {/* Card 4 */}
              <div className="stat-card bg-[#d8cbf9] text-[#1e293b] p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-3 opacity-90 mb-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.7905 5.25H8.4594L7.7094 7.5H3V18H6.02658C6.20854 19.2721 7.30257 20.25 8.625 20.25C9.94743 20.25 11.0415 19.2721 11.2234 18H13.5266C13.7085 19.2721 14.8026 20.25 16.125 20.25C17.4474 20.25 18.5415 19.2721 18.7234 18H21V13.0986L18.5563 11.4695L16.1746 7.5H12.5405L11.7905 5.25ZM10.9594 7.5L10.7094 6.75H9.54053L9.29053 7.5H10.9594ZM18.4974 16.5H19.5V13.9014L17.7729 12.75H12V9H4.5V16.5H6.25261C6.67391 15.6131 7.57785 15 8.625 15C9.67215 15 10.5761 15.6131 10.9974 16.5H13.7526C14.1739 15.6131 15.0779 15 16.125 15C17.1721 15 18.0761 15.6131 18.4974 16.5ZM15.3254 9L16.6754 11.25H13.5V9H15.3254ZM9.75 17.625C9.75 18.2463 9.24632 18.75 8.625 18.75C8.00368 18.75 7.5 18.2463 7.5 17.625C7.5 17.0037 8.00368 16.5 8.625 16.5C9.24632 16.5 9.75 17.0037 9.75 17.625ZM17.25 17.625C17.25 18.2463 16.7463 18.75 16.125 18.75C15.5037 18.75 15 18.2463 15 17.625C15 17.0037 15.5037 16.5 16.125 16.5C16.7463 16.5 17.25 17.0037 17.25 17.625ZM7.5 9.75V11.25H6V12.75H7.5V14.25H9V12.75H10.5V11.25H9V9.75H7.5Z"></path>
                  </svg>
                  <span className="text-sm font-medium">บริการส่งยา (Drug Delivery)</span>
                </div>
                <AnimatedStat value={stats.drugDelivery} Component="h2" className="text-[1.8rem] md:text-[2.8rem] font-bold mt-auto" />
              </div>
            </div>
          </div>

          <div className={secondaryClasses}>
            {/* --- แถวที่ 1: การ์ด 5 ใบ --- */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
              {[
                { label: <>ผู้รับบริการ OPD<br /><span className="text-xs"></span></>, val: stats.customOpdTotal, bg: "bg-[#a6e3e9]" },
                { label: <>ซักประวัติ</>, val: stats.waitingScreening, bg: "bg-[#fbcad4]" },
                { label: <>รอตรวจ</>, val: stats.waitingExam, bg: "bg-[#fce3a1]" },
                { label: <>รอ Lab</>, val: stats.waitingLab, bg: "bg-[#c3e8ff]" },
                { label: <>X-ray</>, val: stats.waitingXray, bg: "bg-[#dcdde1]" }
              ].map((item, idx) => (
                <div key={idx} className={`${item.bg} text-[#1e293b] p-4 rounded-xl shadow-sm flex flex-col items-center min-h-[140px] text-center`}>
                  <div className="h-12 flex items-center justify-center mb-2">
                    <p className="text-[13px] font-medium leading-tight">{item.label}</p>
                  </div>
                  <div className="mt-auto">
                    <AnimatedStat value={item.val} Component="h3" className="text-[1.6rem] md:text-[2.5rem] font-bold" />
                  </div>
                </div>
              ))}
            </div>

            {/* --- แถวที่ 2: การ์ด Gradient และ การ์ดสถานะท้าย --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
              {/* ฝั่งซ้าย: Gradient 4 ช่อง */}
              <div className="lg:col-span-5 bg-gradient-to-br from-[#cce4f7] to-[#d6cbfb] p-6 rounded-2xl shadow-sm text-gray-800">
                <div className="grid grid-cols-2 gap-y-6 h-full relative">
                  {/* เส้นแบ่งกลางแนวตั้งและแนวนอน */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-[1px] bg-white/50"></div>
                    <div className="absolute h-full w-[1px] bg-white/50"></div>
                  </div>

                  {[
                    { label: "ระยะเวลารอคอย เฉลี่ยรวม", val: stats.avgWaitAll, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                    { label: "ระยะเวลา รอซักประวัติ", val: stats.avgWaitScreening, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                    { label: "ระยะเวลา รอพบแพทย์", val: stats.avgWaitExamTotal, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                    { label: "ระยะเวลา รอรับยา", val: stats.avgWaitPharmacy, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center p-2 min-h-[100px] text-center z-10">
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-700">{item.label}</p>
                        {item.label2 && <p className="text-xs font-medium text-gray-600">{item.label2}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={item.icon}></path>
                        </svg>
                        <h3 className="text-2xl font-bold">
                          <span>{item.val.split(' ')[0]}</span>
                          {item.val.includes('ชม.') && <span className="text-base font-normal ml-1 mr-1">ชม.</span>}
                          <span>{item.val.split(' ')[2] || ''}</span>
                          <span className="text-base font-normal ml-1">น.</span>
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ฝั่งขวา: การ์ด 3 ใบสุดท้าย */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "รอรับยา", val: stats.waitingPharmacy, bg: "bg-[#ccf2f4]" },
                  { label: "รอจ่ายเงิน", val: stats.waitingFinance, bg: "bg-[#fdeedc]" },
                  { label: "กลับบ้าน", val: stats.goHome, bg: "bg-[#d3ccf8]" }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`${item.bg} text-[#1e293b] p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[140px] text-center`}
                  >
                    <p className="text-[15px] font-medium mb-3">
                      {item.label}
                    </p>

                    <AnimatedStat
                      value={item.val}
                      Component="h3"
                      className="text-[3.5rem] font-bold leading-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div >
    </>
  );
}