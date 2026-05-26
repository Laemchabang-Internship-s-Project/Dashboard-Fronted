import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGetInternal } from "../services/api";
import { DashboardStyles } from '../components/DashboardUI';
import { LiveClock } from '../components/ChartComponents';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRotateRight,
    faCircleCheck,
    faCircleDot,
    faTruckMedical,
    faCalendarDays,
    faMagnifyingGlass,
    faChartPie
} from '@fortawesome/free-solid-svg-icons';

// Component สำหรับทำแอนิเมชันตัวเลขวิ่ง
const AnimatedStat = ({ value, suffix = "", className = "" }) => {
    const [display, setDisplay] = useState("-");
    const frameRef = useRef(null);

    useEffect(() => {
        if (value === "-" || value == null || isNaN(value)) { setDisplay(value || "-"); return; }
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

const formatShortDate = (dateStr) => {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
};

export default function ReferOutDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState({ text: "Connecting...", type: "neutral" });
    const [referData, setReferData] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // State สำหรับ Filter ช่วงเวลา (อิงค่าเริ่มต้นแบบเดียวกับห้องผ่าตัด)
    const [isFilterMode, setIsFilterMode] = useState(false);
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);

    // ─── States และฟังก์ชันสำหรับดึงรายละเอียดเคสรายกลุ่มความรุนแรง ─────────────────
    const [selectedCases, setSelectedCases] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeSeverityTitle, setActiveSeverityTitle] = useState("");
    const [isCasesLoading, setIsCasesLoading] = useState(false);

    const handleFetchCases = async (severityId, title) => {
        setIsCasesLoading(true);
        setActiveSeverityTitle(title);
        setSelectedCases([]);
        setIsModalOpen(true);
        try {
            const response = await apiGetInternal(`/api/referout/cases?severity_id=${severityId}&start_date=${startDate}&end_date=${endDate}`);
            if (response && response.status === "success" && Array.isArray(response.data)) {
                setSelectedCases(response.data);
            }
        } catch (error) {
            console.error("Error fetching refer cases:", error);
        } finally {
            setIsCasesLoading(false);
        }
    };

    // ฟังก์ชันดึงข้อมูลจาก API Summary ของระบบ
    const fetchReferData = useCallback(async (queryParam = "view=today") => {
        try {
            const response = await apiGetInternal(`/api/referout/summary?${queryParam}`);
            if (response && response.status === "success") {
                setReferData(response.data);
                if (response.view === "range") {
                    setIsFilterMode(true);
                    setStatus({ text: "FILTERED", type: "neutral" });
                } else {
                    setIsFilterMode(false);
                    setStatus({ text: "LIVE", type: "success" });
                }
            }
        } catch (error) {
            console.error("Error fetching refer out data:", error);
            setStatus({ text: "ERROR", type: "error" });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // รัน Polling ข้อมูล Real-time เฉพาะตอนไม่ได้เปิดโหมดฟิลเตอร์ย้อนหลัง
    useEffect(() => {
        if (!isFilterMode) {
            fetchReferData("view=today");
            const poll = setInterval(() => fetchReferData("view=today"), 30000);
            return () => clearInterval(poll);
        }
    }, [isFilterMode, fetchReferData]);

    // ฟังก์ชันจัดการปุ่มรีเฟรช
    const handleRefresh = async () => {
        setIsRefreshing(true);
        if (isFilterMode) {
            await fetchReferData(`view=range&start_date=${startDate}&end_date=${endDate}`);
        } else {
            await fetchReferData("view=today");
        }
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // ฟังก์ชันจัดการค้นหาช่วงวันที่
    const handleSearch = (e) => {
        if (e) e.preventDefault();

        if (startDate === todayStr && endDate === todayStr) {
            setIsFilterMode(false);
            setIsLoading(true);
            fetchReferData("view=today");
            return;
        }

        // คำนวณความต่างของวันที่เลือก (Limit 1 ปีตามสถาปัตยกรรมของระบบ)
        const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 365) {
            alert("⚠️ สามารถเลือกช่วงเวลาดูข้อมูลย้อนหลังได้สูงสุดไม่เกิน 1 ปี (365 วัน) ครับ");
            return;
        }

        setIsLoading(true);
        fetchReferData(`view=range&start_date=${startDate}&end_date=${endDate}`);
    };

    // ตั้งค่าโครงสร้าง UI สำหรับแต่ละประเภทความรุนแรง (เพิ่มไอดี 1-6 เพื่อใช้ส่งให้ Endpoint)
    const severityConfigs = [
        { id: 1, key: 'life_threatening_count', title: 'Life Threatening', badgeBg: 'bg-red-50', badgeText: 'text-red-600', border: 'border-red-200', iconColor: 'text-red-500' },
        { id: 2, key: 'emergency_count', title: 'Emergency', badgeBg: 'bg-orange-50', badgeText: 'text-orange-600', border: 'border-orange-200', iconColor: 'text-orange-500' },
        { id: 3, key: 'urgent_count', title: 'Urgent', badgeBg: 'bg-amber-50', badgeText: 'text-amber-600', border: 'border-amber-200', iconColor: 'text-amber-500' },
        { id: 4, key: 'acute_count', title: 'Acute', badgeBg: 'bg-yellow-50', badgeText: 'text-yellow-600', border: 'border-yellow-200', iconColor: 'text-yellow-500' },
        { id: 5, key: 'non_acute_count', title: 'Non Acute', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600', border: 'border-emerald-200', iconColor: 'text-emerald-500' },
        { id: 6, key: 'unknown_count', title: 'Unknown / อื่นๆ', badgeBg: 'bg-slate-50', badgeText: 'text-slate-600', border: 'border-slate-200', iconColor: 'text-slate-500' }
    ];

    return (
        <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
            <Helmet>
                <title>Refer Out - LCBH</title>
            </Helmet>
            <DashboardStyles />

            <div className="max-w-[1600px] mx-auto space-y-5 pb-20">

                {/* Header Block แกะดีไซน์และข้อความมาจากห้องผ่าตัดเป๊ะๆ */}
                <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                            การส่งต่อผู้ป่วย (Refer Out) {isFilterMode ? "ข้อมูลสถิติย้อนหลัง" : "Real-Time"}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            {isFilterMode ? `แสดงผลยอดรวมจำนวนครั้งการส่งต่อผู้ป่วย ในช่วงวันที่ ${formatShortDate(startDate)} ถึง ${formatShortDate(endDate)}` : "ภาพรวมยอดการส่งต่อผู้ป่วยและระดับความเร่งด่วนในปัจจุบัน"}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl hover:bg-white hover:text-teal-600 hover:border-teal-200 hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>

                        <div className="flex flex-col items-end whitespace-nowrap">
                            <LiveClock />
                        </div>

                        <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${status.type === 'success' ? 'bg-green-100 text-green-700' :
                            status.text === 'FILTERED' ? 'bg-blue-100 text-blue-700' :
                                status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {status.text}
                        </span>
                    </div>
                </div>

                {/* แผงฟอร์มตัวกรอง ย้ายลงมาอยู่นอกกล่องหัวหน้าตามต้องการ */}
                <form onSubmit={handleSearch} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                        <FontAwesomeIcon icon={faCalendarDays} className="text-gray-400" />
                        <span>เลือกช่วงเวลาสถิติ:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            max={todayStr}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                        />
                        <span className="text-gray-400 text-sm">ถึง</span>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate}
                            max={todayStr}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                        />
                    </div>

                    <button
                        type="submit"
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    >
                        <FontAwesomeIcon icon={faMagnifyingGlass} size="sm" />
                        ค้นหาข้อมูล
                    </button>

                    {isFilterMode && (
                        <button
                            type="button"
                            onClick={() => {
                                setStartDate(todayStr);
                                setEndDate(todayStr);
                                setIsLoading(true);
                                fetchReferData("view=today");
                            }}
                            className="text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl px-4 py-1.5 transition-colors font-medium mr-auto shadow-sm active:scale-95 cursor-pointer flex items-center justify-center w-28"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </form>

                {/* Content Section */}
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                        {/* กล่อง Total Cases */}
                        <div className="xl:col-span-1 bg-gradient-to-b from-teal-700 to-teal-900 rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden text-white">
                            <div className="absolute -right-6 -top-6 text-white/5 text-9xl">
                                <FontAwesomeIcon icon={faTruckMedical} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-lg font-bold text-teal-100">ยอดส่งต่อรวม<br />(Total Refer Out)</h2>
                                    {!isFilterMode ? (
                                        <span className="text-[10px] px-2 py-1 rounded-md font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 backdrop-blur-sm">
                                            <FontAwesomeIcon icon={faCircleDot} className="animate-pulse text-emerald-400" />
                                            LIVE TODAY
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-2 py-1 rounded-md font-bold bg-white/10 text-teal-100 border border-white/20 flex items-center gap-1.5 backdrop-blur-sm">
                                            <FontAwesomeIcon icon={faCircleCheck} className="text-teal-300" />
                                            FILTERED
                                        </span>
                                    )}
                                </div>

                                <div className="mt-8 mb-4">
                                    <span className="text-7xl font-black tracking-tighter drop-shadow-lg">
                                        <AnimatedStat value={referData?.total_all_cases || 0} />
                                    </span>
                                    <span className="text-xl font-medium text-teal-200 ml-2">เคส</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-teal-600/50 relative z-10">
                                <div className="flex justify-between items-center text-xs font-medium text-teal-100/70">
                                    <span>ข้อมูลทั้งหมดจาก HOSxP</span>
                                    <FontAwesomeIcon icon={faChartPie} />
                                </div>
                            </div>
                        </div>

                        {/* กลุ่มกล่องย่อยแจกแจงระดับความรุนแรง */}
                        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {severityConfigs.map((cfg) => {
                                const countValue = referData ? referData[cfg.key] : 0;
                                const totalValue = referData?.total_all_cases || 0;
                                const percent = totalValue > 0 ? ((countValue / totalValue) * 100).toFixed(1) : 0;

                                return (
                                    <div
                                        key={cfg.key}
                                        onClick={() => handleFetchCases(cfg.id, cfg.title)}
                                        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer active:scale-[0.99]"
                                    >
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-sm font-bold text-slate-700">{cfg.title}</h3>

                                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.border}`}>
                                                <FontAwesomeIcon icon={faCircleDot} className={cfg.iconColor} />
                                                {percent}%
                                            </span>
                                        </div>

                                        <div className="mt-6 flex items-end justify-between">
                                            <div>
                                                <span className="text-4xl font-black text-slate-800 group-hover:text-teal-700 transition-colors">
                                                    <AnimatedStat value={countValue} />
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 mt-4 pt-3 border-t border-gray-100">
                                            <div className="bg-slate-50 rounded-xl px-3 py-2 flex justify-between items-center">
                                                <span className="text-xs text-slate-500 font-medium">สัดส่วนต่อยอดรวม:</span>
                                                <div className="w-1/2 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full ${cfg.badgeBg.replace('50', '500')}`}
                                                        style={{ width: `${percent}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                )}

                {/* หน้าต่างแสดงผล Modal สำหรับรายละเอียดเคสส่งต่อ */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">

                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                        รายชื่อกลุ่ม {activeSeverityTitle}
                                    </h3>
                                    <p className="text-gray-400 text-xs mt-0.5">
                                        ช่วงวันที่: {formatShortDate(startDate)} ถึง {formatShortDate(endDate)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-sm transition-all font-semibold active:scale-95"
                                >
                                    ปิดหน้าต่าง
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto flex-1">
                                {isCasesLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                                        <span className="text-gray-400 text-sm">กำลังโหลดข้อมูลการวินิจฉัย...</span>
                                    </div>
                                ) : selectedCases.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        ไม่พบประวัติข้อมูลส่งต่อในกลุ่มความรุนแรงนี้
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                        {selectedCases.map((item, index) => (
                                            <div key={item.referout_id || index} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                                        ReferOut ID: {item.referout_id}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-semibold text-gray-700 pt-1">
                                                    การวินิจฉัยเบื้องต้น (Pre-Diagnosis):
                                                </div>
                                                <p className="text-gray-600 text-sm bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-line">
                                                    {item.pre_diagnosis}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}