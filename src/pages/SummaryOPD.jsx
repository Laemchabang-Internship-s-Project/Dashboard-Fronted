import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faWalking, faLaptopMedical, faTruckMedical, faClock } from '@fortawesome/free-solid-svg-icons';
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
    <>
      <Helmet>
        <title>OPD Summary - LCBH</title>
      </Helmet>

      <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
        <style>{`
          .stat-card { transition: all 0.25s ease; }
          .stat-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
          .glass { background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); }
          .soft-shadow { box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .flash { animation: flash 0.4s ease; }
          @keyframes flash { 0%{background-color:rgba(99,102,241,0.15)} 100%{background-color:transparent} }
        `}</style>

        <div className="max-w-7xl mx-auto">

          {/* ── SKELETON ── */}
          {isLoading ? (
            <div className="space-y-6">
              <HeaderSkeleton />
              <StatCardSkeleton count={4} />
              <StatCardSkeleton count={5} />
              <WaitTimeSkeleton />
            </div>
          ) : (
            <>
              {/* ── HEADER BAR ── */}
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6 glass p-4 md:p-5 rounded-2xl soft-shadow border border-white/40">
                <div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight">OPD DASHBOARD</h1>
                  <p className="text-gray-500 text-sm mt-1 font-medium">ภาพรวมการให้บริการห้องตรวจ</p>
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

              {/* ── ROW 1: การ์ดหลัก 4 ใบ ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {topCards.map((c, idx) => (
                  <div key={idx}
                    className="stat-card p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[140px]"
                    style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-outline">{c.icon}</span>
                      <span className="text-sm font-bold text-outline uppercase">{c.label.split(' (')[0]}</span>
                    </div>
                    <AnimatedStat value={c.val} Component="h2" className="text-3xl md:text-5xl font-black mt-auto text-outline" />
                  </div>
                ))}
              </div>

              {/* ── SECONDARY (dim เมื่อ filter) ── */}
              <div className={secondaryClasses}>

                {/* ── ROW 2: คิว 5 ช่อง ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  {midCards.map((c, idx) => (
                    <div key={idx}
                      className="stat-card p-4 rounded-xl shadow-sm flex flex-col items-center min-h-[140px] text-center"
                      style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
                      <div className="h-12 flex items-center justify-center mb-2">
                        <p className="text-sm font-bold leading-tight text-outline px-1">{c.label}</p>
                      </div>
                      <div className="mt-auto">
                        <AnimatedStat value={c.val} Component="h3" className="text-3xl md:text-4xl font-black text-outline" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── ROW 3: เวลารอ + คิวล่าง ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">

                  {/* เวลารอเฉลี่ย 4 ช่อง (เปลี่ยนเป็น Card แยก) */}
                  <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                    {waitItems.map((item, idx) => (
                      <div key={idx} className="stat-card flex flex-col items-center justify-center p-4 min-h-[120px] text-center rounded-2xl"
                        style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}>
                        <p className="text-[12px] font-bold text-outline mb-2 uppercase leading-tight">{item.label}</p>
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faClock} className="text-white text-sm text-outline" />
                          <h3 className="text-xl md:text-2xl font-black text-outline">
                            {item.val}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* คิวรอรับยา / จ่ายเงิน / กลับบ้าน */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {botCards.map((c, idx) => (
                      <div key={idx}
                        className="stat-card p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[140px] text-center"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
                        <p className="text-sm font-bold mb-3 text-outline">{c.label}</p>
                        <AnimatedStat value={c.val} Component="h3" className="text-5xl font-black leading-none text-outline" />
                      </div>
                    ))}
                  </div>

                </div>
              </div>
              {/* ── END SECONDARY ── */}

            </>
          )}
        </div>
      </div>
    </>
  );
}