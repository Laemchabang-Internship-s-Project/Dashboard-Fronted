import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faChartSimple, faCalendarDays, faUser, faChartLine, faCircleCheck, faCircleXmark, faClock } from '@fortawesome/free-solid-svg-icons';
import { Helmet } from "react-helmet-async";
import { apiGet, createEventSource } from "../services/api";

const STATUS_OK = ["ปกติ", "ok", "ดี", "good", "normal", "เต็ม", "พอเพียง", "อนุมัติแล้ว", "ผ่าน"];
const STATUS_WARN = ["ต่ำ", "low", "น้อย", "ต่ำกว่ามาตรฐาน", "เกือบหมด", "รอ"];
const STATUS_BAD = ["ผิดปกติ", "bad", "เสีย", "ไม่ปกติ", "error", "หมด", "ไม่อนุมัติ"];

const MACHINE_CAPACITY = {
  "เครื่องที่ 1": 655, "1": 655,
  "เครื่องที่ 2": 636, "2": 636,
  "เครื่องที่ 3": 650, "3": 650
};

const MACHINE_COLORS = {
  "เครื่องที่ 1": "#3b82f6", "1": "#3b82f6",
  "เครื่องที่ 2": "#f59e0b", "2": "#f59e0b",
  "เครื่องที่ 3": "#10b981", "3": "#10b981",
  "default": "#6366f1"
};

export default function GasInspection() {
  const [allRecords, setAllRecords] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusText, setStatusText] = useState("Connecting...");
  const [statusColor, setStatusColor] = useState("bg-gray-100 text-gray-500");
  const [lastUpdated, setLastUpdated] = useState("รอข้อมูล...");
  const [currentTime, setCurrentTime] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

  const getMachineCapacity = (m) => {
    if (!m) return 1000;
    const str = String(m).trim();
    if (MACHINE_CAPACITY[str]) return MACHINE_CAPACITY[str];
    if (str.includes("1")) return 655;
    if (str.includes("2")) return 636;
    if (str.includes("3")) return 650;
    return 1000;
  };

  const getBadgeClass = (val) => {
    if (!val) return "bg-[#f1f5f9] text-[#64748b]";
    const v = val.toLowerCase();
    if (STATUS_OK.some(k => v.includes(k))) return "bg-[#dcfce7] text-[#166534]";
    if (STATUS_WARN.some(k => v.includes(k))) return "bg-[#fef9c3] text-[#854d0e]";
    if (STATUS_BAD.some(k => v.includes(k))) return "bg-[#fee2e2] text-[#991b1b]";
    return "bg-[#f1f5f9] text-[#64748b]";
  };

  const getFuelColor = (pct) => {
    if (pct >= 0.5) return '#22c55e';
    if (pct >= 0.25) return '#f59e0b';
    return '#ef4444';
  };

  const loadHistory = async () => {
    try {
      const data = await apiGet("/api/fuel/history?limit=100");
      const records = data.records || [];
      setAllRecords(records);

      if (records.length > 0 && records[0].timestamp) {
        const ts = records[0].timestamp; // Expected: "19/04/2026 16:47:45"
        const [d, t] = ts.split(' ');
        setLastUpdated(`${d} (${t || ''})`);
      } else {
        setLastUpdated("ไม่พบข้อมูล");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // อัปเดตเวลาปัจจุบัน (Clock) เหมือนหน้า Summary
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

  useEffect(() => {
    loadHistory();

    const es = createEventSource("/api/dashboard/stream");
    es.onopen = () => {
      setStatusText("LIVE");
      setStatusColor("bg-green-100 text-green-700");
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const fuel = data?.car?.fuel_latest;
        if (!fuel) return;
        setAllRecords(prev => {
          if (prev.length > 0 && prev[0].timestamp === fuel.timestamp) return prev;

          if (fuel.timestamp) {
            const [d, t] = fuel.timestamp.split(' ');
            setLastUpdated(`${d} (${t || ''})`);
          }

          return [fuel, ...prev];
        });
      } catch (e) { }
    };
    es.onerror = () => {
      setStatusText("RECONNECTING");
      setStatusColor("bg-orange-100 text-orange-700");
    };

    return () => es.close();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActiveFilter("all");
    await loadHistory();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredRecords = activeFilter === "all" ? allRecords : allRecords.filter(r => r.machine === activeFilter);
  const knownMachines = [...new Set(allRecords.map(r => r.machine).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    let labels = [];
    let datasets = [];

    // ฟังก์ชันช่วยเรียงลำดับวันที่ (DD/MM/YYYY)
    const parseDate = (dStr) => {
      if (!dStr || dStr === "—") return new Date(0);
      const parts = dStr.split('/');
      if (parts.length < 3) return new Date(0);
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    if (activeFilter === 'all') {
      // โหมดแสดงผลรวม: รวมทุกเครื่องบนแกนวันที่เดียวกัน
      // 1. หาวันที่ที่มีข้อมูลทั้งหมด และเรียงลำดับจากเก่าไปใหม่
      const allUniqueDates = [...new Set(allRecords.map(r => r.date).filter(Boolean))]
        .sort((a, b) => parseDate(a) - parseDate(b));

      // 2. เลือก 15 วันล่าสุด
      const recentDates = allUniqueDates.slice(-15);
      labels = recentDates.map(d => {
        const p = d.split('/');
        return p[1] ? `${p[0]}/${p[1]}` : d;
      });

      // 3. สร้าง Dataset สำหรับแต่ละเครื่อง
      knownMachines.forEach(m => {
        const color = MACHINE_COLORS[m] || MACHINE_COLORS.default;
        const dataForMachine = recentDates.map(d => {
          // หาข้อมูลล่าสุดของเครื่องนี้ในวันที่ d
          const match = allRecords.find(r => r.machine === m && r.date === d);
          if (!match) return null;
          const val = !isNaN(parseFloat(match.fuel_level_aft)) && parseFloat(match.fuel_level_aft) > 0
            ? parseFloat(match.fuel_level_aft)
            : (parseFloat(match.fuel_level_be4) || 0);
          return val;
        });

        datasets.push({
          label: m,
          data: dataForMachine,
          borderColor: color,
          backgroundColor: color + '20',
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          spanGaps: true
        });
      });
    } else {
      // โหมดรายเครื่อง: เรียงลำดับรายการจากเก่าไปใหม่
      const chartData = [...filteredRecords]
        .sort((a, b) => parseDate(a.date) - parseDate(b.date))
        .slice(-15);

      const dataPoints = [];
      const backgroundColors = [];
      const machineColor = MACHINE_COLORS[activeFilter] || MACHINE_COLORS.default;

      chartData.forEach(r => {
        const d = r.date || "—";
        const p = d.includes('/') ? d.split('/') : [d, ""];
        labels.push(p[1] ? `${p[0]}/${p[1]}` : d);

        const val = !isNaN(parseFloat(r.fuel_level_aft)) && parseFloat(r.fuel_level_aft) > 0
          ? parseFloat(r.fuel_level_aft)
          : (parseFloat(r.fuel_level_be4) || 0);
        dataPoints.push(val);

        const pct = val / getMachineCapacity(r.machine);
        backgroundColors.push(pct < 0.25 ? '#ef4444' : pct < 0.50 ? '#f59e0b' : machineColor);
      });

      datasets.push({
        label: activeFilter,
        data: dataPoints,
        borderColor: machineColor,
        backgroundColor: machineColor + '10',
        pointBackgroundColor: backgroundColors,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        borderWidth: 3,
        fill: true,
        tension: 0.3
      });
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: activeFilter === 'all',
            position: 'top',
            labels: { boxWidth: 12, font: { size: 10 } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: activeFilter === 'all' ? 800 : getMachineCapacity(activeFilter),
            ticks: { font: { size: 10 } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 } }
          }
        }
      }
    });
  }, [allRecords, filteredRecords, activeFilter]);

  return (
    <div className="p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
      <Helmet>
        <title>Gas Summary - LCBH</title>
        <meta name="description" content="ข้อมูลระดับน้ำมันและแก๊สของเครื่องจักรต่างๆ อัปเดตอัตโนมัติจาก Google Form" />
      </Helmet>

      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">แดชบอร์ดสรุป น้ำมัน</h1>
            <p className="text-gray-400 text-sm mt-1">ข้อมูลล่าสุดจาก Google Form | อัปเดตอัตโนมัติ</p>
          </div>
          <div className="flex items-center gap-3 mt-2 md:mt-0">
            <button onClick={handleRefresh} disabled={isRefreshing} className={`p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl transition hover:bg-white shadow-sm ${isRefreshing ? 'opacity-50' : ''}`}>
              <FontAwesomeIcon icon={faRotateRight} className={`${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex flex-col items-end whitespace-nowrap">
              <p className="text-gray-600 font-semibold text-sm leading-tight">{currentTime}</p>
              <span className="text-[10px] text-gray-400 leading-tight">{lastUpdated}</span>
            </div>
            <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${statusColor}`}>{statusText}</span>
          </div>
        </div>

        <style>{`
          .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
          .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        `}</style>

        <div>
          <h2 className="font-bold text-gray-700 text-base mb-3"><FontAwesomeIcon icon={faChartSimple} className="text-blue-600 mr-2" />สรุปล่าสุดแต่ละเครื่อง</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {knownMachines.map(m => {
              const r = allRecords.find(rec => rec.machine === m);
              if (!r) return null;

              const maxCap = getMachineCapacity(m);
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
              const sweepDeg = Math.round(pct * 180 * 10) / 10;
              const needleDeg = Math.round((pct * 180 - 90) * 10) / 10;

              const isApproved = r.app_name && r.app_name.trim() !== "" && r.app_name !== "—";
              const isRejected = STATUS_BAD.some(k => (r.status || "").toLowerCase().includes(k));

              return (
                <div key={m} onClick={() => setActiveFilter(m)} className={`bg-white rounded-2xl p-4 border-2 cursor-pointer transition flex flex-col items-center justify-center w-full sm:w-[240px] ${activeFilter === m ? 'border-blue-800 shadow-md' : 'border-gray-100 hover:-translate-y-1'}`}>
                  <div className="flex flex-col items-center mb-3 w-full gap-1">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold">{m}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${isRejected ? 'bg-red-100 text-red-800' : isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      <FontAwesomeIcon icon={isRejected ? faCircleXmark : isApproved ? faCircleCheck : faClock} />
                      {isRejected ? 'ไม่อนุมัติ' : isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                    </span>
                  </div>

                  <div className="mb-2 px-2 w-full max-w-[160px]">
                    <div className="relative w-full aspect-[2/1] rounded-t-full overflow-hidden bg-slate-200 mx-auto" style={{ '--gauge-color': color, '--gauge-deg': sweepDeg + 'deg', '--needle-deg': needleDeg + 'deg' }}>
                      <div className="absolute inset-0 w-full h-full" style={{ background: `conic-gradient(from 270deg at 50% 100%, var(--gauge-color) 0deg, var(--gauge-color) var(--gauge-deg), transparent var(--gauge-deg))` }}></div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[68%] aspect-[2/1] rounded-t-full bg-white z-10"></div>
                      <div className="absolute bottom-0 left-1/2 origin-bottom-center w-[3px] h-[44%] bg-slate-700 rounded-full z-20" style={{ transform: `translateX(-50%) rotate(var(--needle-deg))` }}></div>
                      <div className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 w-[28%] aspect-square rounded-full bg-white border-[3px] border-slate-200 z-30"></div>
                    </div>
                    <div className="flex justify-center items-baseline gap-1 mt-1 text-center">
                      <span style={{ color: isValid ? color : '#94a3b8' }} className="text-base font-black">{isValid ? numVal : '—'}</span>
                      <span className="text-[10px] text-gray-400">/ {maxCap} L</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1 justify-center w-full">
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 uppercase tracking-tighter">ก่อน</p>
                      <p className="text-sm font-bold text-slate-600">{fuelBe4 !== "—" ? fuelBe4 + " L" : "—"}</p>
                    </div>
                    <span className="text-gray-300 text-xs">→</span>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 uppercase tracking-tighter">หลัง</p>
                      <p className={`text-sm font-bold ${didRefuel ? 'text-green-600' : 'text-gray-400'}`}>{fuelAft !== "—" ? fuelAft + " L" : "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-50 w-full text-center">
                    <p className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                      <FontAwesomeIcon icon={faCalendarDays} className="mr-1 opacity-70" />
                      {r.date || "—"} {r.timestamp?.split(' ')[1] ? `(${r.timestamp.split(' ')[1]})` : ""}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                      <FontAwesomeIcon icon={faUser} className="mr-1 opacity-70" /> {r.tech_name || "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
          <div className="flex justify-between items-end mb-4">
            <h2 className="font-bold text-gray-700 text-base"><FontAwesomeIcon icon={faChartLine} className="text-blue-600 mr-2" />แนวโน้มระดับน้ำมัน: <span className="text-blue-600">{activeFilter === 'all' ? 'ทั้งหมด' : activeFilter}</span></h2>
            <span className="text-[10px] text-gray-400">15 รายการล่าสุด</span>
          </div>
          <div className="relative w-full h-[250px]">
            <canvas ref={canvasRef}></canvas>
          </div>
        </div>

        <p className="text-gray-400 text-xs text-right m-0 pb-1">*หลัง Redis restart หรือเมื่อข้อมูลใน Redis ไม่ตรงกับ Sheet ให้run backfillHistory ใน apps script</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 justify-between items-center">
            <h2 className="font-bold text-gray-700">ประวัติการตรวจเช็ค <span className="text-sm text-gray-400 font-normal">({filteredRecords.length} รายการ)</span></h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setActiveFilter("all")} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${activeFilter === "all" ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600"}`}>ทั้งหมด</button>
              {knownMachines.map(m => (
                <button key={m} onClick={() => setActiveFilter(m)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${activeFilter === m ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-left whitespace-nowrap">#</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">วันที่</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">เครื่อง</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">น้ำมันก่อน</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">น้ำมันหลัง</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">ขั้วแบต</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">น้ำกลั่น</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">หม้อน้ำ</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">น้ำมันเครื่อง</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">ไฟควบคุม</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">ผู้ตรวจ</th>
                  <th className="px-3 py-3 text-center whitespace-nowrap">สถานะ</th>
                  <th className="px-3 py-3 text-left whitespace-nowrap">ผู้อนุมัติ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr><td colSpan="13" className="text-center py-12 text-gray-400">ไม่มีข้อมูล</td></tr>
                ) : (
                  filteredRecords.map((r, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-blue-50 transition">
                      <td className="px-2 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-700">{r.date || "—"}</div>
                        <div className="text-xs text-gray-400">{r.timestamp || ""}</div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap"><span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">{r.machine || "—"}</span></td>
                      <td className="px-2 py-3 text-center font-bold text-slate-600 whitespace-nowrap">{r.fuel_level_be4 ?? "—"} L</td>
                      <td className="px-2 py-3 text-center font-bold text-green-600 whitespace-nowrap">{r.fuel_level_aft ?? "—"} L</td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.battery_pole)}`}>{r.battery_pole || "—"}</span></td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.battery_water)}`}>{r.battery_water || "—"}</span></td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.radiator_water)}`}>{r.radiator_water || "—"}</span></td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.engine_oil)}`}>{r.engine_oil || "—"}</span></td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.control_light)}`}>{r.control_light || "—"}</span></td>
                      <td className="px-2 py-3 text-gray-700 whitespace-nowrap">{r.tech_name || "—"}</td>
                      <td className="px-2 py-3 text-center whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${getBadgeClass(r.status)}`}>{r.status || "—"}</span></td>
                      <td className="px-2 py-3 text-gray-500 whitespace-nowrap">{r.app_name || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div >
  );
}