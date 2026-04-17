import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faWalking, faLaptopMedical, faTruckMedical } from '@fortawesome/free-solid-svg-icons';

const API_URL = "http://localhost:8000";
const API_KEY = "";

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

      let url = `${API_URL}/api/dashboard/stream`;
      if (API_KEY) url += `?api_key=${API_KEY}`;

      es = new EventSource(url);

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
        const res = await fetch(`${API_URL}/api/dashboard/snapshot`, {
          headers: API_KEY ? { "x-api-key": API_KEY } : {}
        });
        const data = await res.json();

        if (isCancelled) return; // ถ้าเปลี่ยนโหมดไปแล้ว ไม่ต้องทำต่อ

        console.log("✅ Snapshot Loaded Successfully");
        updateDashboardData(data);
        connectSSE();
      } catch (err) {
        console.error("❌ Snapshot error:", err);
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
      const res = await fetch(`${API_URL}/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`, {
        headers: API_KEY ? { "x-api-key": API_KEY } : {}
      });
      const responseData = await res.json();
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
    <div className="p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
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
        <div className="flex justify-between items-center mb-6 glass p-5 rounded-2xl soft-shadow border border-white/40">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">แดชบอร์ดสรุป </h1>
            <p className="text-gray-400 text-sm mt-1">การให้บริการต่าง ๆ</p>
          </div>

          <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af]" />
            <span className="text-gray-500 text-sm">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af]" />
            <button onClick={applyDateFilter}
              className="bg-[#1e40af] hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded transition shadow-sm">ค้นหา</button>
            <button onClick={clearDateFilter}
              className={`bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition ${!isFilterMode ? 'hidden' : ''}`}>ล้าง</button>
          </div>

          <div className="flex items-center gap-3 whitespace-nowrap whitespace-nowrap">
            <p className="text-gray-600 font-semibold text-sm">{currentTime}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>{status.text}</span>

          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Card 1 */}
          <div className="stat-card bg-[#1e40af] text-white p-5 rounded-lg shadow-md relative overflow-hidden flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center gap-3 opacity-80 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <span className="text-base">รวมผู้รับบริการทั้งหมด (OPD Total)</span>
            </div>
            <AnimatedStat value={stats.opdTotal} Component="h2" className="text-[2.8rem] font-bold mt-auto" />
          </div>

          {/* Card 2 */}
          <div className="stat-card bg-[#75cf48] text-white p-5 rounded-lg shadow-md flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center gap-3 opacity-80 mb-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M13 6C14.1046 6 15 5.10457 15 4C15 2.89543 14.1046 2 13 2C11.8955 2 11 2.89543 11 4C11 5.10457 11.8955 6 13 6ZM11.0528 6.60557C11.3841 6.43992 11.7799 6.47097 12.0813 6.68627L13.0813 7.40056C13.3994 7.6278 13.5559 8.01959 13.482 8.40348L12.4332 13.847L16.8321 20.4453C17.1384 20.9048 17.0143 21.5257 16.5547 21.8321C16.0952 22.1384 15.4743 22.0142 15.168 21.5547L10.5416 14.6152L9.72611 13.3919C9.58336 13.1778 9.52866 12.9169 9.57338 12.6634L10.1699 9.28309L8.38464 10.1757L7.81282 13.0334C7.70445 13.575 7.17759 13.9261 6.63604 13.8178C6.09449 13.7094 5.74333 13.1825 5.85169 12.641L6.51947 9.30379C6.58001 9.00123 6.77684 8.74356 7.05282 8.60557L11.0528 6.60557ZM16.6838 12.9487L13.8093 11.9905L14.1909 10.0096L17.3163 11.0513C17.8402 11.226 18.1234 11.7923 17.9487 12.3162C17.7741 12.8402 17.2078 13.1234 16.6838 12.9487ZM6.12844 20.5097L9.39637 14.7001L9.70958 15.1699L10.641 16.5669L7.87159 21.4903C7.60083 21.9716 6.99111 22.1423 6.50976 21.8716C6.0284 21.6008 5.85768 20.9911 6.12844 20.5097Z"></path>
              </svg>
              <span className="text-base text-white">Walk-in (ผู้ป่วยเดินทางมาเอง)</span>
            </div>
            <AnimatedStat value={stats.walkIn} Component="h2" className="text-[2.8rem] font-bold mt-auto" />
          </div>

          {/* Card 3 */}
          <div className="stat-card bg-[#e88843] text-white p-5 rounded-lg shadow-md flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center gap-3 opacity-80 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span className="text-base">Telemedicine (รับบริการทางไกล)</span>
            </div>
            <AnimatedStat value={stats.telemed} Component="h2" className="text-[2.8rem] font-bold mt-auto" />
          </div>

          {/* Card 4 */}
          <div className="stat-card bg-[#4b5563] text-white p-5 rounded-lg shadow-md flex flex-col justify-between min-h-[140px]">
            <div className="flex items-center gap-3 opacity-80 mb-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.7905 5.25H8.4594L7.7094 7.5H3V18H6.02658C6.20854 19.2721 7.30257 20.25 8.625 20.25C9.94743 20.25 11.0415 19.2721 11.2234 18H13.5266C13.7085 19.2721 14.8026 20.25 16.125 20.25C17.4474 20.25 18.5415 19.2721 18.7234 18H21V13.0986L18.5563 11.4695L16.1746 7.5H12.5405L11.7905 5.25ZM10.9594 7.5L10.7094 6.75H9.54053L9.29053 7.5H10.9594ZM18.4974 16.5H19.5V13.9014L17.7729 12.75H12V9H4.5V16.5H6.25261C6.67391 15.6131 7.57785 15 8.625 15C9.67215 15 10.5761 15.6131 10.9974 16.5H13.7526C14.1739 15.6131 15.0779 15 16.125 15C17.1721 15 18.0761 15.6131 18.4974 16.5ZM15.3254 9L16.6754 11.25H13.5V9H15.3254ZM9.75 17.625C9.75 18.2463 9.24632 18.75 8.625 18.75C8.00368 18.75 7.5 18.2463 7.5 17.625C7.5 17.0037 8.00368 16.5 8.625 16.5C9.24632 16.5 9.75 17.0037 9.75 17.625ZM17.25 17.625C17.25 18.2463 16.7463 18.75 16.125 18.75C15.5037 18.75 15 18.2463 15 17.625C15 17.0037 15.5037 16.5 16.125 16.5C16.7463 16.5 17.25 17.0037 17.25 17.625ZM7.5 9.75V11.25H6V12.75H7.5V14.25H9V12.75H10.5V11.25H9V9.75H7.5Z"></path>
              </svg>
              <span className="text-base">บริการส่งยา (Drug Delivery)</span>
            </div>
            <AnimatedStat value={stats.drugDelivery} Component="h2" className="text-[2.8rem] font-bold mt-auto" />
          </div>
        </div>

        <div className={secondaryClasses}>
          {/* --- แถวที่ 1: การ์ดสีน้ำเงิน 5 ใบ --- */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: <>รวมผู้รับบริการ<br />ผู้ป่วยนอก</>, val: stats.customOpdTotal },
              { label: <>จำนวน ผู้รอรับบริการ<br />รอซักประวัติ</>, val: stats.waitingScreening },
              { label: <>จำนวน รอตรวจ</>, val: stats.waitingExam },
              { label: <>จำนวน รอ Lab</>, val: stats.waitingLab },
              { label: <>จำนวน รอ X-ray</>, val: stats.waitingXray }
            ].map((item, idx) => (
              <div key={idx} className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center min-h-[140px] text-center">
                <div className="h-12 flex items-center justify-center mb-2">
                  <p className="text-sm opacity-80 font-light leading-tight">{item.label}</p>
                </div>
                <div className="mt-auto">
                  <AnimatedStat value={item.val} Component="h3" className="text-[2.5rem] font-bold" />
                </div>
              </div>
            ))}
          </div>

          {/* --- แถวที่ 2: การ์ด Gradient และ การ์ดสถานะท้าย --- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* ฝั่งซ้าย: Gradient 4 ช่อง */}
            <div className="lg:col-span-5 bg-gradient-to-br from-teal-300 via-cyan-200 to-yellow-200 p-4 rounded-3xl shadow-md">
              <div className="grid grid-cols-2 gap-4 h-full">
                {[
                  { label: "ระยะเวลารอคอย เฉลี่ยรวม", val: stats.avgWaitAll, color: "text-yellow-300" },
                  { label: "ระยะเวลา รอซักประวัติ", val: stats.avgWaitScreening, color: "text-cyan-300" },
                  { label: "ระยะเวลา รอตรวจ", val: stats.avgWaitExamTotal, color: "text-cyan-300" },
                  { label: "ระยะเวลา รอรับยา", val: stats.avgWaitPharmacy, color: "text-emerald-300" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center p-4 min-h-[120px] text-center shadow-sm">
                    <div className="h-10 flex items-center justify-center mb-1">
                      <p className="text-[1.05rem] opacity-80 font-light">{item.label}</p>
                    </div>
                    <div className="mt-auto">
                      <h3 className={`text-3xl font-bold ${item.color}`}>
                        <span>{item.val}</span>
                        <span className="text-sm ml-1 font-normal text-white">น.</span>
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ฝั่งขวา: การ์ด 3 ใบสุดท้าย */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "จำนวน รอรับยา", val: stats.waitingPharmacy, bg: "bg-[#51abbd]" },
                { label: "จำนวน รอจ่ายเงิน", val: stats.waitingFinance, bg: "bg-[#51abbd]" },
                { label: "จำนวน กลับบ้าน", val: stats.goHome, bg: "bg-[#30c978]" }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`${item.bg} text-white p-3 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[110px] text-center`}
                >
                  <p className="text-lg font-light mb-1">
                    {item.label}
                  </p>

                  <AnimatedStat
                    value={item.val}
                    Component="h3"
                    className="text-[3rem] font-bold"
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
    </div >
  );
}