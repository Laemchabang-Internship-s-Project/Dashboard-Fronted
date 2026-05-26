import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGet, apiGetInternal, createInternalEventSource } from "../services/api";
import { HeaderSkeleton, StatCardSkeleton, DepartmentBlockSkeleton } from '../components/Skeleton';
import { DashboardHeader } from '../components/DashboardUI';
import { TechnicalServicesCard } from '../components/TechnicalServicesCard';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

// --- Helper: แปลงนาทีเป็น ชม./นาที ---
function formatWaitTime(minutes) {
  if (minutes == null || isNaN(minutes)) return "-";
  if (minutes < 60) return `${Math.round(minutes)} นาที`;

  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} ชม. ${mins} น.`;
}

// --- Helper: แปลง 2026-05-01 เป็น 01-05-2026 ---
const formatShortDate = (dateStr) => {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
};

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

// ฟังก์ชันสำหรับดึงวันที่ปัจจุบัน (YYYY-MM-DD)
const getToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DepartmentBlockBowin = ({ title, stats, theme }) => {
  const isBlue = theme === 'blue';
  const containerBg = isBlue
    ? "bg-gradient-to-br from-cyan-50 to-blue-100"
    : "bg-gradient-to-br from-lime-50 to-emerald-100";
  const borderColor = isBlue ? "border-blue-200" : "border-emerald-200";
  const titleBarColor = isBlue ? "bg-blue-600" : "bg-emerald-600";
  const timeBoxText = isBlue ? "text-blue-900" : "text-emerald-900";

  return (
    <div className={`p-5 rounded-[28px] shadow-md border ${borderColor} mb-6 ${containerBg} relative overflow-hidden`}>
      <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-3">
        <div className={`w-2.5 h-7 ${titleBarColor} rounded-full shadow-sm`}></div>
        {title}
      </h2>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl text-center shadow-sm border border-white/50">
          <p className="text-[13px] font-bold text-gray-500 mb-1 uppercase tracking-tight">ผู้รับบริการ OPD</p>
          <AnimatedStat value={stats.total} Component="p" className="text-2xl md:text-3xl font-extrabold text-gray-800" />
        </div>
        <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl text-center shadow-sm border border-white/50">
          <p className="text-[13px] font-bold text-gray-500 mb-1 uppercase tracking-tight">ซักประวัติ</p>
          <AnimatedStat value={stats.waitingScreening} Component="p" className="text-2xl md:text-3xl font-extrabold text-gray-800" />
        </div>
        <div className="bg-white/30 p-3 rounded-2xl shadow-sm border border-white/50">
          <p className="text-[13px] font-bold text-gray-500 mb-1 uppercase tracking-tight text-center">รอตรวจ (ทั่วไป/ฟัน)</p>
          <div className="flex flex-col gap-0">
            <div className="flex justify-between items-baseline px-2 border-b border-gray-100">
              <span className="text-[12px] text-gray-400">OPD:</span>
              <AnimatedStat value={stats.waitingExamCount} className="text-xl font-bold text-blue-600" />
            </div>
            <div className="flex justify-between items-baseline px-2">
              <span className="text-[12px] text-gray-400">ทันตกรรม:</span>
              <AnimatedStat value={stats.waitingDental} className="text-xl font-bold text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center border border-white/20">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">เฉลี่ยรวม</p>
          <p className={`text-lg font-black ${timeBoxText}`}>{stats.avgTotal}</p>
        </div>
        <div className="bg-white/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center border border-white/20">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">รอซักประวัติ</p>
          <p className={`text-lg font-black ${timeBoxText}`}>{stats.avgWaitScreening}</p>
        </div>
        <div className="bg-white/30 p-3 rounded-2xl flex flex-col items-center justify-center border border-white/20">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">รอพบแพทย์</p>
          <div className="w-full text-[12px] font-bold text-right space-y-0.5">
            <div className="flex justify-between"><span className="text-gray-400 font-normal">OPD:</span> <span className={timeBoxText}>{stats.avgWaitExam}</span></div>
            <div className="flex justify-between"><span className="text-gray-400 font-normal">ทันตกรรม:</span> <span className="text-emerald-800">{stats.avgWaitDental}</span></div>
          </div>
        </div>
        <div className="bg-white/30 p-3 rounded-2xl flex flex-col items-center justify-center text-center border border-white/20">
          <p className="text-[11px] font-semibold text-gray-600 mb-1">รอรับยา</p>
          <p className={`text-lg font-black ${timeBoxText}`}>{stats.avgWaitDrug}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`${isBlue ? 'bg-blue-200/50' : 'bg-emerald-200/50'} p-4 rounded-2xl text-center border border-white/40`}>
          <p className={`text-sm font-bold ${isBlue ? 'text-blue-800' : 'text-emerald-800'} mb-1`}>รอรับยา</p>
          <AnimatedStat value={stats.waitingDrug} className="text-2xl md:text-3xl font-black text-gray-800" />
        </div>
        <div className="bg-orange-100/60 p-4 rounded-2xl text-center border border-white/40">
          <p className="text-sm font-bold text-orange-800 mb-1">รอจ่ายเงิน</p>
          <AnimatedStat value={stats.waitingPayment} className="text-2xl md:text-3xl font-black text-gray-800" />
        </div>
        <div className="bg-purple-100/60 p-4 rounded-2xl text-center border border-white/40">
          <p className="text-sm font-bold text-purple-800 mb-1">กลับบ้าน</p>
          <AnimatedStat value={stats.goHome} className="text-2xl md:text-3xl font-black text-gray-800" />
        </div>
      </div>
    </div>
  );
};

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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "ผู้รับบริการ OPD", val: stats.total },
          { label: "ซักประวัติ", val: stats.waitingScreening },
          { label: "รอตรวจ", val: stats.waitingExamCount },
          { label: "รอ Lab", val: stats.waitingLab },
          { label: "X-ray", val: stats.waitingXray },
        ].map((item, i) => (
          <div key={i} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl text-center shadow-sm border border-white/50">
            <p className="text-[12px] font-bold text-gray-500 mb-1 uppercase tracking-tight leading-none">{item.label}</p>
            <AnimatedStat value={item.val} Component="p" className="text-2xl md:text-3xl font-extrabold text-gray-800" />
          </div>
        ))}
      </div>

      <div className="flex justify-center mb-6">
        <div className="bg-white/40 backdrop-blur-sm px-6 py-2 rounded-xl text-center shadow-sm border border-white/40 flex items-center gap-3">
          <p className="text-[13px] font-bold text-gray-500 uppercase tracking-widest leading-none">ส่งต่อ / อื่น ๆ</p>
          <AnimatedStat value={stats.redirected} Component="p" className="text-xl font-extrabold text-blue-600" />
        </div>
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
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  );
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  // Filter States
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [secondaryState, setSecondaryState] = useState("normal"); // normal, filtered, hidden
  const [techServices, setTechServices] = useState(null);

  // Filter States (สถิติรายแผนก)
  const [isDeptFilterMode, setIsDeptFilterMode] = useState(false);
  const [deptFilterDate, setDeptFilterDate] = useState(getToday());
  const [systemStats, setSystemStats] = useState({
    opdTotal: "-", walkIn: "-", telemed: "-", drugDelivery: "-",
    drugDeliveryPostal: "-",
    drugDeliveryRider: "-",
  });

  const initialDepState = {
    total: 0, waitingScreening: 0, waitingExamCount: 0, waitingLab: 0, waitingXray: 0,
    avgTotal: "-", avgWaitScreening: "-", avgWaitExam: "-", avgWaitDrug: "-",
    waitingDrug: 0, waitingPayment: 0, goHome: 0
  };
  const [stats010, setStats010] = useState(initialDepState);
  const [stats062, setStats062] = useState(initialDepState);
  const [stats109, setStats109] = useState(initialDepState);
  const [stats110, setStats110] = useState(initialDepState);
  const [stats111, setStats111] = useState(initialDepState);
  const [stats108, setStats108] = useState(initialDepState);
  const [stats011, setStats011] = useState(initialDepState);
  const [stats075, setStats075] = useState(initialDepState);
  const [stats044, setStats044] = useState(initialDepState);
  const [stats033, setStats033] = useState(initialDepState);
  const [stats072, setStats072] = useState(initialDepState);
  const [stats063, setStats063] = useState(initialDepState);
  const [stats005, setStats005] = useState(initialDepState);
  const [stats042, setStats042] = useState(initialDepState);
  const [stats041, setStats041] = useState(initialDepState);
  const [stats074, setStats074] = useState(initialDepState);
  const [statsBowinAll, setStatsBowinAll] = useState(initialDepState);

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
    if (!data || isFilterMode || isDeptFilterMode) return;

    if (data.technical_services) {
      setTechServices(data.technical_services);
    }

    const s = data.system;
    const rooms = data.opd_clinics?.rooms || [];

    setSystemStats({
      opdTotal: s?.total_OPD ?? "-",
      walkIn: s?.total_walkin ?? "-",
      telemed: s?.hos_telemed ?? "-",
      drugDelivery: s?.total_drug_delivery ?? "-",
      drugDeliveryPostal: s?.total_drug_delivery_postal ?? "-",
      drugDeliveryRider: s?.total_drug_delivery_rider ?? "-"
    });

    const HOS_TOTAL_DEPTS = new Set(["062", "072", "063", "033", "044"]);

    const mapDept = (mainCode, extraCodes = []) => {
      const allCodes = [mainCode, ...extraCodes];

      const mergedStats = allCodes.reduce((acc, code) => {
        const deptSpecific = data.opd_clinics?.[`stats_${code}`] || {};
        const room = rooms.find(r => r.room_code === code) || {};

        acc.waiting_screening += deptSpecific.waiting_screening || 0;
        acc.waiting_exam += deptSpecific.waiting_exam || 0;
        acc.waiting_lab += deptSpecific.waiting_lab || 0;
        acc.waiting_xray += deptSpecific.waiting_xray || 0;
        acc.waiting_drug += deptSpecific.waiting_drug || 0;
        acc.waiting_payment += deptSpecific.waiting_payment || 0;
        acc.finished += deptSpecific.finished || 0;

        const hosTotal = deptSpecific.total || 0;
        const neoqTotal = room.total || 0;

        const useHos = HOS_TOTAL_DEPTS.has(code);
        acc.total += useHos ? hosTotal : (neoqTotal > 0 ? neoqTotal : hosTotal);
        acc.hos_total += hosTotal;

        return acc;
      }, {
        total: 0, hos_total: 0,
        waiting_screening: 0, waiting_exam: 0, waiting_lab: 0,
        waiting_xray: 0, waiting_drug: 0, waiting_payment: 0, finished: 0
      });

      const sumHOSStates =
        mergedStats.waiting_screening +
        mergedStats.waiting_exam +
        mergedStats.waiting_lab +
        mergedStats.waiting_xray +
        mergedStats.waiting_drug +
        mergedStats.waiting_payment +
        mergedStats.finished;

      const redirected = Math.max(0, mergedStats.total - sumHOSStates);
      const depSum = data.summary?.[`dep_${mainCode}`] || {};

      return {
        total: mergedStats.total,
        waitingScreening: mergedStats.waiting_screening,
        waitingExamCount: mergedStats.waiting_exam,
        waitingLab: mergedStats.waiting_lab,
        waitingXray: mergedStats.waiting_xray,
        redirected: redirected,
        avgTotal: formatWaitTime(depSum.avg_total),
        avgWaitScreening: formatWaitTime(depSum.avg_wait_screening),
        avgWaitExam: formatWaitTime(depSum.avg_wait_exam),
        avgWaitDrug: formatWaitTime(depSum.avg_wait_drug),
        waitingDrug: mergedStats.waiting_drug,
        waitingPayment: mergedStats.waiting_payment,
        goHome: mergedStats.finished
      };
    };

    setStats010(mapDept("010"));
    setStats062(mapDept("062"));
    setStats108(mapDept("108", ["069"]));
    setStats109(mapDept("109", ["047"]));
    setStats110(mapDept("110", ["059"]));
    setStats111(mapDept("111", ["076"]));
    setStats011(mapDept("011"));
    setStats075(mapDept("075"));
    setStats044(mapDept("044"));
    setStats033(mapDept("033"));
    setStats072(mapDept("072"));
    setStats063(mapDept("063"));
    setStats005(mapDept("005"));
    setStats042(mapDept("042"));
    setStats041(mapDept("041"));
    setStats074(mapDept("074"));

    const stats901 = mapDept("901");
    const stats902 = mapDept("902");
    const stats903 = mapDept("903");
    const stats904 = mapDept("904");
    const stats905 = mapDept("905");

    setStatsBowinAll({
      total: stats901.total + stats902.total + stats903.total + stats904.total + stats905.total,
      waitingScreening: stats902.waitingScreening,
      waitingExamCount: stats903.waitingExamCount,
      waitingDental: stats905.waitingExamCount,
      waitingDrug: stats904.waitingDrug + stats902.waitingDrug,
      waitingPayment: stats902.waitingPayment + stats903.waitingPayment + stats905.waitingPayment,
      goHome: stats901.goHome + stats902.goHome + stats903.goHome + stats904.goHome + stats905.goHome,
      avgTotal: stats902.avgTotal,
      avgWaitScreening: stats902.avgWaitScreening,
      avgWaitExam: stats902.avgWaitExam,
      avgWaitDental: stats905.avgWaitExam,
      avgWaitDrug: stats902.avgWaitDrug,
      redirected: 0,
    });
  };

  const applyDateFilter = async () => {
    if (!startDate || !endDate) {
      return alert("กรุณาเลือกช่วงเวลา");
    }

    setIsFilterMode(true);
    setSecondaryState("filtered");

    try {
      const resp = await apiGet(
        `/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`
      );
      const d = resp.data || {};

      setSystemStats({
        opdTotal: d.opd_total ?? "-",
        walkIn: d.walk_in ?? "-",
        telemed: d.telemed ?? "-",
        drugDelivery: d.drug_delivery ?? "-",
        drugDeliveryPostal: d.total_drug_delivery_postal ?? "-",
        drugDeliveryRider: d.total_drug_delivery_rider ?? "-"
      });

      setSecondaryState("filtered");
    } catch (err) {
      console.error("Date filter error:", err);
    }
  };

  const applyDeptFilter = async () => {
    if (!deptFilterDate) return alert("กรุณาเลือกวันที่");
    setIsDeptFilterMode(true);
    try {
      const resp = await apiGet(`/api/dashboard/opd-dept-range?start_date=${deptFilterDate}`);
      const depts = resp.departments;

      if (resp.technical_services) {
        setTechServices(resp.technical_services);
      }

      const findDept = (code) => depts.find(d => d.dept_code === code) || {};

      const mapHistoricalDept = (mainCode, extraCodes = []) => {
        const allCodes = [mainCode, ...extraCodes];
        const merged = allCodes.reduce((acc, code) => {
          const d = findDept(code);
          acc.total += d.total_opd || 0;
          acc.waitingScreening += d.waiting_screening || 0;
          acc.waitingExamCount += d.waiting_exam || 0;
          acc.waitingLab += d.waiting_lab || 0;
          acc.waitingXray += d.waiting_xray || 0;
          acc.waitingDrug += d.waiting_drug || 0;
          acc.waitingPayment += d.waiting_payment || 0;
          acc.goHome += d.go_home || 0;
          acc.other += d.other || 0;
          return acc;
        }, {
          total: 0, waitingScreening: 0, waitingExamCount: 0,
          waitingLab: 0, waitingXray: 0, waitingDrug: 0,
          waitingPayment: 0, goHome: 0, other: 0
        });

        const d = findDept(mainCode);
        return {
          ...merged,
          redirected: merged.other,
          avgTotal: formatWaitTime(d.avg_wait_total),
          avgWaitScreening: formatWaitTime(d.avg_wait_screening),
          avgWaitExam: formatWaitTime(d.avg_wait_exam),
          avgWaitDrug: formatWaitTime(d.avg_wait_drug),
        };
      };

      setStats010(mapHistoricalDept("010"));
      setStats062(mapHistoricalDept("062"));
      setStats108(mapHistoricalDept("108"));
      setStats109(mapHistoricalDept("109"));
      setStats110(mapHistoricalDept("110"));
      setStats111(mapHistoricalDept("111"));
      setStats011(mapHistoricalDept("011"));
      setStats075(mapHistoricalDept("075"));
      setStats044(mapHistoricalDept("044"));
      setStats033(mapHistoricalDept("033"));
      setStats072(mapHistoricalDept("072"));
      setStats063(mapHistoricalDept("063"));
      setStats005(mapHistoricalDept("005"));
      setStats042(mapHistoricalDept("042"));
      setStats041(mapHistoricalDept("041"));
      setStats074(mapHistoricalDept("074"));

      const b901 = findDept("901"), b902 = findDept("902"),
        b903 = findDept("903"), b904 = findDept("904"), b905 = findDept("905");
      setStatsBowinAll({
        total: (b901.total_opd || 0) + (b902.total_opd || 0) + (b903.total_opd || 0) + (b904.total_opd || 0) + (b905.total_opd || 0),
        waitingScreening: b902.waiting_screening || 0,
        waitingExamCount: b903.waiting_exam || 0,
        waitingDental: b905.waiting_exam || 0,
        waitingDrug: (b904.waiting_drug || 0) + (b902.waiting_drug || 0),
        waitingPayment: (b902.waiting_payment || 0) + (b903.waiting_payment || 0) + (b905.waiting_payment || 0),
        goHome: (b901.go_home || 0) + (b902.go_home || 0) + (b903.go_home || 0) + (b904.go_home || 0) + (b905.go_home || 0),
        avgTotal: formatWaitTime(b902.avg_wait_total),
        avgWaitScreening: formatWaitTime(b902.avg_wait_screening),
        avgWaitExam: formatWaitTime(b902.avg_wait_exam),
        avgWaitDental: formatWaitTime(b905.avg_wait_exam),
        avgWaitDrug: formatWaitTime(b902.avg_wait_drug),
        redirected: 0,
      });

      setSecondaryState("normal");
    } catch (err) {
      console.error("Dept filter error:", err);
    }
  };

  const clearDeptFilter = () => {
    setIsDeptFilterMode(false);
    setDeptFilterDate(getToday());
    if (!isFilterMode) setSecondaryState("normal");
  };

  const clearDateFilter = async () => {
    setStartDate(getToday());
    setEndDate(getToday());
    setIsFilterMode(false);
    setSecondaryState("normal");

    try {
      const data = await apiGetInternal("/api/dashboard/internal/snapshot");
      processData(data);
    } catch (err) {
      console.error("Reload snapshot error:", err);
    }
  };

  useEffect(() => {
    let es = null;
    let isCancelled = false;

    const connectSSE = () => {
      if (isFilterMode || isDeptFilterMode || isCancelled) return;

      es = createInternalEventSource("/api/dashboard/internal/stream");

      es.onopen = () => {
        if (isCancelled) { es.close(); return; }
        setStatus({ text: "LIVE", color: "bg-green-100 text-green-700 font-bold" });
      };

      es.onmessage = (e) => {
        if (isCancelled || isFilterMode || isDeptFilterMode) return;
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
          if (!isFilterMode && !isDeptFilterMode && !isCancelled) {
            connectSSE();
          }
        }, 3000);
      };
    };

    const loadInit = async () => {
      if (isFilterMode) return;
      try {
        const data = await apiGetInternal("/api/dashboard/internal/snapshot");
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

    if (!isFilterMode && !isDeptFilterMode) {
      loadInit();
    }

    return () => {
      isCancelled = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [isFilterMode, isDeptFilterMode]);

  const secondaryClasses = "transition-all duration-300";

  return (
    <div className="p-3 md:p-6 min-h-screen bg-[#f1f5f9]" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <Helmet><title>OPD Summary - LCBH</title></Helmet>

      <style>{`
        .stat-card { transition: all 0.25s ease; }
        .stat-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); }
        .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
        .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-4">

        {isLoading ? (
          <div className="space-y-6">
            <HeaderSkeleton />
            <StatCardSkeleton count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DepartmentBlockSkeleton />
              <DepartmentBlockSkeleton />
            </div>
          </div>
        ) : (
          <>
            {/* ===== HEADER ===== */}
            <DashboardHeader
              title="Dashboard"
              subtitle="ภาพรวมระบบ"
              statusText={(isFilterMode || isDeptFilterMode) ? "Filter Mode" : status.text}
              statusColorClass={(isFilterMode || isDeptFilterMode) ? "bg-amber-100 text-amber-700 font-bold" : status.color}
            />

            {/* ===== แผงตัวกรองสไตล์ REFER OUT ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ชุดที่ 1: ช่วงเวลาสถิติระบบ */}
              <div className="bg-white p-4 rounded-[20px] border border-slate-200/80 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <FontAwesomeIcon icon={faCalendarDays} className="text-blue-600 text-base" />
                  <span>ช่วงเวลาสถิติภาพรวมระบบ</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">เริ่ม:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-slate-700 font-semibold text-sm focus:outline-none w-full cursor-pointer"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>

                  <div className="text-slate-400 font-medium text-center sm:text-left">ถึง</div>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">สิ้นสุด:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-slate-700 font-semibold text-sm focus:outline-none w-full cursor-pointer"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={applyDateFilter}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold h-[38px] px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 flex-1 sm:flex-none shrink-0 active:scale-95 cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                      <span>ค้นหา</span>
                    </button>

                    {isFilterMode && (
                      <button
                        onClick={clearDateFilter}
                        className="text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl h-[38px] px-4 transition-colors font-medium shadow-sm active:scale-95 cursor-pointer flex items-center justify-center w-28 shrink-0"
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                </div>
                {isFilterMode && (
                  <p className="text-gray-400 text-xs mt-0.5 pl-1">
                    ช่วงวันที่: {formatShortDate(startDate)} ถึง {formatShortDate(endDate)}
                  </p>
                )}
              </div>

              {/* ชุดที่ 2: สถิติรายแผนกย้อนหลัง */}
              <div className="bg-white p-4 rounded-[20px] border border-slate-200/80 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <FontAwesomeIcon icon={faCalendarDays} className="text-purple-600 text-base" />
                  <span>ข้อมูลรายแผนกย้อนหลัง</span>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">เลือกวันที่:</span>
                    <input
                      type="date"
                      value={deptFilterDate}
                      onChange={(e) => setDeptFilterDate(e.target.value)}
                      className="bg-transparent text-slate-700 font-semibold text-sm focus:outline-none w-full cursor-pointer"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>

                  <button
                    onClick={applyDeptFilter}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold h-[38px] px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                    <span>ค้นหา</span>
                  </button>

                  {isDeptFilterMode && (
                    <button
                      onClick={clearDeptFilter}
                      className="text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl h-[38px] px-4 transition-colors font-medium shadow-sm active:scale-95 cursor-pointer flex items-center justify-center w-28 shrink-0"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
                {isDeptFilterMode && (
                  <p className="text-gray-400 text-xs mt-0.5 pl-1">
                    วันที่เลือกรายแผนก: {formatShortDate(deptFilterDate)}
                  </p>
                )}
              </div>

            </div>

            {/* Top 4 Global Cards */}
            <div className="rounded-[20px] p-[6px] mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-[6px]">
                <div className="stat-card bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">ผู้รับบริการทั้งหมด</span>
                  </div>
                  <AnimatedStat value={systemStats.opdTotal} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6C14.1046 6 15 5.10457 15 4C15 2.89543 14.1046 2 13 2C11.8955 2 11 2.89543 11 4C11 5.10457 11.8955 6 13 6ZM11.0528 6.60557C11.3841 6.43992 11.7799 6.47097 12.0813 6.68627L13.0813 7.40056C13.3994 7.6278 13.5559 8.01959 13.482 8.40348L12.4332 13.847L16.8321 20.4453C17.1384 20.9048 17.0143 21.5257 16.5547 21.8321C16.0952 22.1384 15.4743 22.0142 15.168 21.5547L10.5416 14.6152L9.72611 13.3919C9.58336 13.1778 9.52866 12.9169 9.57338 12.6634L10.1699 9.28309L8.38464 10.1757L7.81282 13.0334C7.70445 13.575 7.17759 13.9261 6.63604 13.8178C6.09449 13.7094 5.74333 13.1825 5.85169 12.641L6.51947 9.30379C6.58001 9.00123 6.77684 8.74356 7.05282 8.60557L11.0528 6.60557ZM16.6838 12.9487L13.8093 11.9905L14.1909 10.0096L17.3163 11.0513C17.8402 11.226 18.1234 11.7923 17.9487 12.3162C17.7741 12.8402 17.2078 13.1234 16.6838 12.9487ZM6.12844 20.5097L9.39637 14.7001L9.70958 15.1699L10.641 16.5669L7.87159 21.4903C7.60083 21.9716 6.99111 22.1423 6.50976 21.8716C6.0284 21.6008 5.85768 20.9911 6.12844 20.5097Z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">Walk-in</span>
                  </div>
                  <AnimatedStat value={systemStats.walkIn} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-gradient-to-br from-[#FFF1F2] to-[#FFE4E6] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    <span className="text-xs md:text-sm font-medium">Telemedicine</span>
                  </div>
                  <AnimatedStat value={systemStats.telemed} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold mt-auto" />
                </div>
                <div className="stat-card bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#1e293b] p-4 md:p-5 rounded-[14px] shadow-sm flex flex-col justify-between min-h-[120px] md:min-h-[140px]">
                  <div className="flex items-center gap-3 opacity-90 mb-1">
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.7905 5.25H8.4594L7.7094 7.5H3V18H6.02658C6.20854 19.2721 7.30257 20.25 8.625 20.25C9.94743 20.25 11.0415 19.2721 11.2234 18H13.5266C13.7085 19.2721 14.8026 20.25 16.125 20.25C17.4474 20.25 18.5415 19.2721 18.7234 18H21V13.0986L18.5563 11.4695L16.1746 7.5H12.5405L11.7905 5.25ZM10.9594 7.5L10.7094 6.75H9.54053L9.29053 7.5H10.9594ZM18.4974 16.5H19.5V13.9014L17.7729 12.75H12V9H4.5V16.5H6.25261C6.67391 15.6131 7.57785 15 8.625 15C9.67215 15 10.5761 15.6131 10.9974 16.5H13.7526C14.1739 15.6131 15.0779 15 16.125 15C17.1721 15 18.0761 15.6131 18.4974 16.5ZM15.3254 9L16.6754 11.25H13.5V9H15.3254ZM9.75 17.625C9.75 18.2463 9.24632 18.75 8.625 18.75C8.00368 18.75 7.5 18.2463 7.5 17.625C7.5 17.0037 8.00368 16.5 8.625 16.5C9.24632 16.5 9.75 17.0037 9.75 17.625ZM17.25 17.625C17.25 18.2463 16.7463 18.75 16.125 18.75C15.5037 18.75 15 18.2463 15 17.625C15 17.0037 15.5037 16.5 16.125 16.5C16.7463 16.5 17.25 17.0037 17.25 17.625ZM7.5 9.75V11.25H6V12.75H7.5V14.25H9V12.75H10.5V11.25H9V9.75H7.5Z"></path>
                    </svg>
                    <span className="text-xs md:text-sm font-medium truncate">บริการส่งยา</span>
                  </div>

                  <div className="flex items-end justify-between mt-auto gap-2">
                    <AnimatedStat value={systemStats.drugDelivery} Component="h2" className="text-[2rem] md:text-[2.8rem] font-bold" />
                    <div className="flex flex-col gap-1.5 w-[45%] max-w-[150px] pb-1">
                      <div className="flex items-center justify-between bg-white/60 px-2 py-1 rounded-md shadow-sm border border-white/50">
                        <span className="text-[11px] md:text-xs text-gray-700 font-medium tracking-wide">ปณ.</span>
                        <AnimatedStat
                          value={systemStats.drugDeliveryPostal !== undefined ? systemStats.drugDeliveryPostal : "-"}
                          Component="span"
                          className="text-sm md:text-base font-bold text-indigo-700"
                        />
                      </div>
                      <div className="flex items-center justify-between bg-white/60 px-2 py-1 rounded-md shadow-sm border border-white/50">
                        <span className="text-[11px] md:text-xs text-gray-700 font-medium tracking-wide">Rider</span>
                        <AnimatedStat
                          value={systemStats.drugDeliveryRider !== undefined ? systemStats.drugDeliveryRider : "-"}
                          Component="span"
                          className="text-sm md:text-base font-bold text-indigo-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Blocks */}
            <div className={secondaryClasses}>
              <div className="grid grid-cols-1 gap-4 md:gap-6 w-full mx-auto">
                <div className="w-full md:max-w-[1000px] mx-auto px-2 md:px-0">
                  <DepartmentBlock
                    title="ผู้รับบริการ OPD (ทั่วไป)"
                    stats={stats010}
                    theme="blue"
                  />

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ผู้รับบริการ OPD (นัด)"
                      stats={stats062}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ผู้รับบริการสูติกรรม"
                      stats={stats109}
                      theme="blue"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ผู้รับบริการศัลยกรรม"
                      stats={stats110}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ผู้รับบริการอายุรกรรม"
                      stats={stats111}
                      theme="blue"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ผู้รับบริการกุมารเวชกรรม"
                      stats={stats108}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="ER Room"
                      stats={stats011}
                      theme="blue"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="อาชีวเวชกรรม"
                      stats={stats075}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="จุดซักประวัติ PCU (วันจันทร์ ฝากครรภ์) (วันอังคาร ฉีดวัคซีน) (วันพุธ ...)"
                      stats={stats044}
                      theme="blue"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="คลินิกทันตกรรม"
                      stats={stats005}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="กายภาพ"
                      stats={stats042}
                      theme="blue"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="แพทย์แผนไทย"
                      stats={stats041}
                      theme="emerald"
                    />
                  </div>

                  <div className="mt-4 md:mt-6">
                    <DepartmentBlock
                      title="หน่วยไตเทียม"
                      stats={stats074}
                      theme="blue"
                    />
                  </div>

                  <div className="border-t border-gray-300 pt-10  mt-10">
                    <DepartmentBlockBowin
                      title="สรุปยอดบริการ (สาขาบ่อวิน)"
                      stats={statsBowinAll}
                      theme="blue"
                    />
                  </div>
                </div>
              </div>
            </div>
            <TechnicalServicesCard data={techServices} />
          </>
        )}
      </div>
    </div >
  );
}