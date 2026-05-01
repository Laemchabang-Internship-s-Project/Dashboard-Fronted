import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faWalking, faLaptopMedical, faTruckMedical, faCircleCheck, faCircleXmark, faClock, faCalendarDays, faUser, faGasPump } from '@fortawesome/free-solid-svg-icons';
import { Helmet } from "react-helmet-async";
import { apiGet, createEventSource } from "../services/api";
import FuelSummaryCard from '../components/FuelSummaryCard';
import { HeaderSkeleton, StatCardSkeleton, FuelCardSkeleton } from '../components/Skeleton';
import toast from 'react-hot-toast';
import { DashboardHeader } from '../components/DashboardUI';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';

const MACHINE_CAPACITY = {
  "เครื่องที่ 1": 655, "1": 655,
  "เครื่องที่ 2": 636, "2": 636,
  "เครื่องที่ 3": 650, "3": 650
};

const getMachineCapacity = (m) => {
  if (!m) return 1000;
  const str = String(m).trim();
  if (MACHINE_CAPACITY[str]) return MACHINE_CAPACITY[str];
  if (str.includes("1")) return 655;
  if (str.includes("2")) return 636;
  if (str.includes("3")) return 650;
  return 1000;
};

const getFuelColor = (pct) => {
  if (pct >= 0.5) return '#22c55e';
  if (pct >= 0.25) return '#f59e0b';
  return '#ef4444';
};

const STATUS_BAD = ["ผิดปกติ", "bad", "เสีย", "ไม่ปกติ", "error", "หมด", "ไม่อนุมัติ"];

function formatWaitTime(minutes) {
  if (minutes == null || isNaN(minutes)) return "-";
  if (minutes < 60) return Number(minutes).toFixed(1);

  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} ชม. ${mins}`;
}

// ฟังก์ชันสำหรับดึงวันที่ปัจจุบัน (YYYY-MM-DD)
const getToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const FuelGaugeCard = ({ machineName, records }) => {
  const r = records.find(rec => rec.machine === machineName);
  if (!r) return null;

  const maxCap = getMachineCapacity(machineName);
  const rawBe4 = r.fuel_level_be4;
  const rawAft = r.fuel_level_aft;
  const aftNum = parseFloat(rawAft);
  const didRefuel = !isNaN(aftNum) && aftNum > 0;

  const fuelBe4 = (rawBe4 != null && rawBe4 !== "") ? rawBe4 : "—";
  const fuelAft = didRefuel ? aftNum : "—";
  const gaugeVal = didRefuel ? rawAft : rawBe4;

  const numVal = parseFloat(gaugeVal);
  const isValid = !isNaN(numVal) && numVal >= 0;
  const pct = isValid ? Math.min(Math.max(numVal / maxCap, 0), 1) : 0;
  const color = isValid ? getFuelColor(pct) : '#cbd5e1';
  const sweepDegree = Math.round(pct * 180 * 10) / 10;
  const needleDegree = Math.round((pct * 180 - 90) * 10) / 10;

  const isApproved = r.app_name && r.app_name.trim() !== "" && r.app_name !== "—";
  const isRejected = STATUS_BAD.some(k => (r.status || "").toLowerCase().includes(k));

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm transition hover:-translate-y-1 flex flex-col items-center justify-center min-h-[160px]">
      <div className="flex flex-col items-center mb-3 w-full gap-1">
        <span className="bg-blue-100 text-blue-700 text-[10px] rounded-full px-2.5 py-0.5 font-bold">{machineName}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${isRejected ? 'bg-red-100 text-red-800' : isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          <FontAwesomeIcon icon={isRejected ? faCircleXmark : isApproved ? faCircleCheck : faClock} />
          {isRejected ? 'ไม่อนุมัติ' : isApproved ? 'อนุมัติแล้ว' : 'รอ'}
        </span>
      </div>

      <div className="mb-2 px-2 w-full max-w-[160px]">
        <div className="relative w-full aspect-[2/1] rounded-t-full overflow-hidden bg-slate-200 mx-auto" style={{ '--gauge-color': color, '--gauge-deg': sweepDegree + 'deg', '--needle-deg': needleDegree + 'deg' }}>
          <div className="absolute inset-0 w-full h-full" style={{ background: `conic-gradient(from 270deg at 50% 100%, var(--gauge-color) 0deg, var(--gauge-color) var(--gauge-deg), transparent var(--gauge-deg))` }}></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[68%] aspect-[2/1] rounded-t-full bg-white z-10"></div>
          <div className="absolute bottom-0 left-1/2 origin-bottom-center w-[3px] h-[44%] bg-slate-700 rounded-full z-20" style={{ transform: `translateX(-50%) rotate(var(--needle-deg))` }}></div>
          <div className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 w-[28%] aspect-square rounded-full bg-white border-[3px] border-slate-200 z-30"></div>
        </div>
        <div className="flex justify-center items-baseline gap-1 mt-1 text-center">
          <span style={{ color: isValid ? color : '#94a3b8' }} className="text-sm font-black">{isValid ? numVal : '—'}</span>
          <span className="text-[10px] text-gray-400">/ {maxCap} L</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-1 justify-center w-full">
        <div className="text-center">
          <p className="text-[8px] text-gray-400 uppercase tracking-tighter">ก่อน</p>
          <p className="text-xs font-bold text-slate-600">{fuelBe4 !== "—" ? fuelBe4 + " L" : "—"}</p>
        </div>
        <span className="text-gray-300 text-[10px]">→</span>
        <div className="text-center">
          <p className="text-[8px] text-gray-400 uppercase tracking-tighter">หลัง</p>
          <p className={`text-xs font-bold ${didRefuel ? 'text-green-600' : 'text-gray-400'}`}>{fuelAft !== "—" ? fuelAft + " L" : "—"}</p>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-50 w-full text-center">
        <p className="text-[9px] text-gray-400">
          <FontAwesomeIcon icon={faCalendarDays} className="mr-1 opacity-70" />
          {r.date || "—"} {r.timestamp ? `(${r.timestamp.split(' ')[1] || ''})` : ''}
        </p>
      </div>
    </div>
  );
};

export default function OPDDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  // Filter states
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [secondaryState, setSecondaryState] = useState("normal"); // normal, filtered, hidden

  // Data states
  const [stats, setStats] = useState({
    opdTotal: "-", walkIn: "-", telemed: "-", drugDelivery: "-",
    customOpdTotal: "-", waitingScreening: "-", waitingExam: "-", waitingLab: "-", waitingXray: "-",
    waitingPharmacy: "-", waitingFinance: "-", goHome: "-",
    avgWaitScreening: "-", avgWaitExamTotal: "-", avgWaitPharmacy: "-", avgWaitAll: "-"
  });
  const [fuelRecords, setFuelRecords] = useState([]);

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
    // 1. เปลี่ยนเงื่อนไขการเช็ค: 
    // หน้า Public จะไม่มี opd_clinics ดังนั้นเราจะเช็คแค่ว่ามี data หรือ data.system หรือไม่
    if (!data || isFilterMode) return;

    // 2. ดึงข้อมูลจากก้อน system
    const s = data.system;

    // 3. ข้อมูลส่วนอื่นๆ ที่ถูก Mask ไว้ (เช่นห้องตรวจ 010 หรือ technical_services)
    // ในหน้า Public ค่าเหล่านี้จะเป็น undefined เราจะป้องกัน Error ด้วยการใส่ Optional Chaining
    const h = data.opd_clinics?.header;
    const rooms = data.opd_clinics?.rooms || [];
    const room010 = rooms.find(r => r.room_code === '010');

    // คำนวณเวลารอ (ซึ่งในหน้า Public จะกลายเป็น 0 เพราะข้อมูลโดนกรองออก)
    const waitScreening = room010?.avg_wait_minutes || 0;
    const waitExam = data.summary?.avg_wait_examination || 0;
    const waitPharmacy = data?.technical_services?.pharmacy?.avg_wait_minutes || 0;
    const totalAvgWait = waitScreening + waitExam + waitPharmacy;

    setStats(prev => ({
      ...prev,
      // 4. อัปเดต 4 ค่าหลักที่ Backend ส่งมาให้
      opdTotal: s?.total_OPD ?? "-",
      walkIn: s?.total_walkin ?? "-",
      telemed: s?.hos_telemed ?? "-",
      drugDelivery: s?.total_drug_delivery ?? "-",

      // 5. ค่าที่เหลือ ถ้าไม่มีข้อมูล (undefined) จะกลายเป็น "-" ตามที่เราเซ็ต Default ไว้
      customOpdTotal: h?.custom_opd_total ?? "-",
      waitingScreening: h?.waiting_screening ?? "-",
      waitingExam: h?.waiting_exam ?? "-",
      waitingLab: data?.technical_services?.lab?.waiting ?? "-",
      waitingXray: data?.technical_services?.xray?.waiting ?? "-",
      waitingPharmacy: data?.technical_services?.pharmacy?.waiting ?? "-",
      waitingFinance: data?.technical_services?.finance?.waiting ?? "-",
      goHome: s?.hos_go_home ?? "-",

      // ถ้าค่าเป็น 0 และเราอยู่โหมด Public ให้โชว์เป็น "-" เพื่อความสวยงาม
      avgWaitScreening: waitScreening ? formatWaitTime(waitScreening) : "-",
      avgWaitExamTotal: waitExam ? formatWaitTime(waitExam) : "-",
      avgWaitPharmacy: waitPharmacy ? formatWaitTime(waitPharmacy) : "-",
      avgWaitAll: totalAvgWait ? formatWaitTime(totalAvgWait) : "-",
    }));
  };

  // จัดการ SSE และ Snapshot
  useEffect(() => {
    let es = null;
    let isCancelled = false;

    const connectSSE = () => {
      if (isFilterMode || isCancelled) return;
      es = createEventSource("/api/dashboard/public/stream");

      es.onopen = () => {
        if (isCancelled) { es.close(); return; }
        setStatus({ text: "LIVE", color: "bg-green-100 text-green-700 font-bold" });
      };

      es.onmessage = (event) => {
        if (isCancelled || isFilterMode) return;
        try {
          const data = JSON.parse(event.data);
          updateDashboardData(data);

          const fuel = data?.car?.fuel_latest;
          if (fuel) {
            setFuelRecords(prev => {
              if (prev.length > 0 && prev[0].timestamp === fuel.timestamp) return prev;
              const idx = prev.findIndex(r => r.machine === fuel.machine);
              if (idx === -1) return [fuel, ...prev];
              const newRecords = [...prev];
              newRecords[idx] = fuel;
              return newRecords;
            });
          }
        } catch (e) {
          console.error("❌ JSON parse error:", e);
        }
      };

      es.onerror = () => {
        if (isFilterMode || isCancelled || !es) return;
        console.error("🔴 SSE Connection Lost");
        setStatus({ text: "RECONNECTING", color: "bg-orange-100 text-orange-700" });

        // แจ้งเตือนเมื่อหลุดการเชื่อมต่อ Real-time
        toast.error("การเชื่อมต่อขัดข้อง กำลังพยายามใหม่...", { id: 'sse-error' });

        es.close();
        es = null;
        setTimeout(() => {
          if (!isFilterMode && !isCancelled) connectSSE();
        }, 3000);
      };
    };

    const loadSnapshot = async () => {
      if (isFilterMode) return;

      // สร้าง Promise รวมสำหรับการดึงข้อมูลเริ่มต้น
      const fetchInitialData = async () => {
        const data = await apiGet("/api/dashboard/public/snapshot");
        updateDashboardData(data);

        try {
          const fuelData = await apiGet("/api/fuel/history?limit=10");
          setFuelRecords(fuelData.records || []);
        } catch (e) {
          // ถ้าน้ำมันโหลดไม่ได้แต่ snapshot ได้ ก็ให้ทำงานต่อ
        }
      };

      // ใช้ toast.promise จัดการสถานะการโหลดครั้งแรก
      toast.promise(fetchInitialData(), {
        loading: 'กำลังโหลดข้อมูลล่าสุด...',
        success: 'อัปเดตข้อมูลสำเร็จ',
        error: 'ไม่สามารถโหลดข้อมูลได้',
      }, { id: 'load-snapshot' });

      try {
        await fetchInitialData();
        if (!isCancelled) {
          setIsLoading(false);
          connectSSE();
        }
      } catch (err) {
        if (!isCancelled) {
          setIsLoading(false);
          connectSSE(); // พยายามต่อ SSE ต่อเผื่อกลับมาได้
        }
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
      toast.error('กรุณาเลือกวันที่ให้ครบถ้วน');
      return;
    }

    setIsFilterMode(true);
    setSecondaryState("filtered");
    setStatus({ text: "FILTERED (HISTORY)", color: "bg-purple-100 text-purple-700 font-bold" });

    // ใช้ toast.promise สำหรับการค้นหาข้อมูลย้อนหลัง
    toast.promise(
      apiGet(`/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`),
      {
        loading: 'กำลังดึงข้อมูลย้อนหลัง...',
        success: 'ดึงข้อมูลย้อนหลังสำเร็จ',
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลย้อนหลัง',
      }
    ).then((responseData) => {
      const data = responseData.data;
      setStats(prev => ({
        ...prev,
        opdTotal: data.opd_total ?? 0,
        walkIn: data.walk_in ?? 0,
        telemed: data.telemed ?? 0,
        drugDelivery: data.drug_delivery ?? 0,
        customOpdTotal: "-",
        waitingScreening: "-",
        waitingExam: "-",
        waitingLab: "-",
        waitingXray: "-",
        waitingPharmacy: "-",
        waitingFinance: "-",
        goHome: "-",
        avgWaitScreening: "-",
        avgWaitExamTotal: "-",
        avgWaitPharmacy: "-",
        avgWaitAll: "-",
      }));
    }).catch((err) => {
      console.error("❌ Filter fetch error:", err);
    });
  };

  const clearDateFilter = () => {
    setStartDate(getToday());
    setEndDate(getToday());
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

  const knownMachines = [...new Set(fuelRecords.map(r => r.machine).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <>
      <Helmet>
        <title>Dashboard Summary - LCBH</title>
      </Helmet>
      <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
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
                    input[type="date"] {
                    position: relative;
                    min-height: 38px;
                    }
                    input[type="date"]::before {
                    content: attr(placeholder);
                    position: absolute;
                    color: #94a3b8;
                    width: 100%;
                    left: 8px;
                    }
                    input[type="date"]:focus::before,
                    input[type="date"]:valid::before,
                    input[type="date"]:not([value=""])::before {
                        display: none;
                        content: "";
                    }
        `}</style>

        <div className="max-w-7xl mx-auto">

          {/* ===== SKELETON LOADING ===== */}
          {isLoading ? (
            <div className="space-y-6">
              <HeaderSkeleton />
              <StatCardSkeleton count={4} />
              <FuelCardSkeleton count={3} />
            </div>
          ) : (
            <>
              {/* ===== HEADER ===== */}
              <DashboardHeader
                title="Dashboard"
                subtitle="ภาพรวมระบบ"
                statusText={status.text}
                statusColorClass={status.color}
              >
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto">
                  <input
                    type="date"
                    value={startDate}
                    placeholder="วว/ดด/ปปปป"
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-[13px] md:text-sm px-2 py-1 rounded border border-gray-300 bg-white text-slate-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-[120px] appearance-none"
                    style={{ colorScheme: 'light' }}
                  />
                  <span className="text-gray-500 text-sm">-</span>
                  <input
                    type="date"
                    value={endDate}
                    placeholder="วว/ดด/ปปปป"
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-[13px] md:text-sm px-2 py-1 rounded border border-gray-300 bg-white text-slate-900 focus:outline-none focus:border-[#1e40af] flex-1 min-w-[120px] appearance-none"
                    style={{ colorScheme: 'light' }}
                  />
                  <button onClick={applyDateFilter}
                    className="bg-[#1e40af] hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded transition shadow-sm whitespace-nowrap active:scale-95">ค้นหา</button>
                  <button onClick={clearDateFilter}
                    className={`bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition ${!isFilterMode ? 'hidden' : ''}`}>ล้าง</button>
                </div>
              </DashboardHeader>



              <div className="rounded-[20px] p-[6px] mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-[6px]">
                  {/* Card 1 */}
                  <div className="stat-card bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                    <div className="flex items-center gap-3 opacity-90 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                      <span className="text-xs md:text-sm font-medium">ผู้รับบริการทั้งหมด</span>
                    </div>
                    <AnimatedStat value={stats.opdTotal} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                  </div>

                  {/* Card 2 */}
                  <div className="stat-card bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                    <div className="flex items-center gap-3 opacity-90 mb-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6C14.1046 6 15 5.10457 15 4C15 2.89543 14.1046 2 13 2C11.8955 2 11 2.89543 11 4C11 5.10457 11.8955 6 13 6ZM11.0528 6.60557C11.3841 6.43992 11.7799 6.47097 12.0813 6.68627L13.0813 7.40056C13.3994 7.6278 13.5559 8.01959 13.482 8.40348L12.4332 13.847L16.8321 20.4453C17.1384 20.9048 17.0143 21.5257 16.5547 21.8321C16.0952 22.1384 15.4743 22.0142 15.168 21.5547L10.5416 14.6152L9.72611 13.3919C9.58336 13.1778 9.52866 12.9169 9.57338 12.6634L10.1699 9.28309L8.38464 10.1757L7.81282 13.0334C7.70445 13.575 7.17759 13.9261 6.63604 13.8178C6.09449 13.7094 5.74333 13.1825 5.85169 12.641L6.51947 9.30379C6.58001 9.00123 6.77684 8.74356 7.05282 8.60557L11.0528 6.60557ZM16.6838 12.9487L13.8093 11.9905L14.1909 10.0096L17.3163 11.0513C17.8402 11.226 18.1234 11.7923 17.9487 12.3162C17.7741 12.3162 17.2078 13.1234 16.6838 12.9487ZM6.12844 20.5097L9.39637 14.7001L9.70958 15.1699L10.641 16.5669L7.87159 21.4903C7.60083 21.9716 6.99111 22.1423 6.50976 21.8716C6.0284 21.6008 5.85768 20.9911 6.12844 20.5097Z"></path></svg>
                      <span className="text-xs md:text-sm font-medium">Walk-in</span>
                    </div>
                    <AnimatedStat value={stats.walkIn} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                  </div>

                  {/* Card 3 */}
                  <div className="stat-card bg-gradient-to-br from-[#FFF1F2] to-[#FFE4E6] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                    <div className="flex items-center gap-3 opacity-90 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      <span className="text-xs md:text-sm font-medium">Telemedicine</span>
                    </div>
                    <AnimatedStat value={stats.telemed} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                  </div>

                  {/* Card 4 */}
                  <div className="stat-card bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                    <div className="flex items-center gap-3 opacity-90 mb-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M11.7905 5.25H8.4594L7.7094 7.5H3V18H6.02658C6.20854 19.2721 7.30257 20.25 8.625 20.25C9.94743 20.25 11.0415 19.2721 11.2234 18H13.5266C13.7085 19.2721 14.8026 20.25 16.125 20.25C17.4474 20.25 18.5415 19.2721 18.7234 18H21V13.0986L18.5563 11.4695L16.1746 7.5H12.5405L11.7905 5.25ZM10.9594 7.5L10.7094 6.75H9.54053L9.29053 7.5H10.9594ZM18.4974 16.5H19.5V13.9014L17.7729 12.75H12V9H4.5V16.5H6.25261C6.67391 15.6131 7.57785 15 8.625 15C9.67215 15 10.5761 15.6131 10.9974 16.5H13.7526C14.1739 15.6131 15.0779 15 16.125 15C17.1721 15 18.0761 15.6131 18.4974 16.5ZM15.3254 9L16.6754 11.25H13.5V9H15.3254ZM9.75 17.625C9.75 18.2463 9.24632 18.75 8.625 18.75C8.00368 18.75 7.5 18.2463 7.5 17.625C7.5 17.0037 8.00368 16.5 8.625 16.5C9.24632 16.5 9.75 17.0037 9.75 17.625ZM17.25 17.625C17.25 18.2463 16.7463 18.75 16.125 18.75C15.5037 18.75 15 18.2463 15 17.625C15 17.0037 15.5037 16.5 16.125 16.5C16.7463 16.5 17.25 17.0037 17.25 17.625ZM7.5 9.75V11.25H6V12.75H7.5V14.25H9V12.75H10.5V11.25H9V9.75H7.5Z"></path></svg>
                      <span className="text-xs md:text-sm font-medium">บริการส่งยา (Drug Delivery)</span>
                    </div>
                    <AnimatedStat value={stats.drugDelivery} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                  </div>
                </div>
              </div>

              {/* ===== Fuel Summary Cards ===== */}
              <div className={secondaryClasses}>
                <h2 className="font-black text-slate-700 text-base mb-3 mt-4 uppercase tracking-wide">
                  <FontAwesomeIcon icon={faGasPump} className="text-blue-600 mr-2" />
                  สรุปนํ้ามันเครื่องกำเนิดไฟฟ้า (Generator)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
                  {isLoading ? (
                    <FuelCardSkeleton count={3} />
                  ) : knownMachines.length === 0 ? (
                    <div className="col-span-full border border-dashed border-gray-300 rounded-2xl p-12 text-center text-slate-400 font-bold bg-white/50">
                      ไม่พบข้อมูลเครื่องจักรในขณะนี้
                    </div>
                  ) : (
                    knownMachines.map(m => (
                      <FuelSummaryCard
                        key={m}
                        machine={m}
                        record={fuelRecords.find(r => r.machine === m)}
                        isActive={false}
                        onClick={() => { }}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div >
    </>
  );
}