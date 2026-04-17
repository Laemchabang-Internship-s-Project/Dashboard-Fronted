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
    const secondaryClasses = `transition-all duration-300 ${
        secondaryState === "filtered" ? "opacity-30 grayscale pointer-events-none" : 
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
                        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">แดชบอร์ดสรุป</h1>
                        <p className="text-gray-400 text-sm mt-1">การให้บริการต่าง ๆ</p>
                    </div>

                    <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm px-2 py-1 rounded border border-gray-300 focus:outline-none focus:border-[#1e40af]" />
                        <span className="text-gray-500 text-sm">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm px-2 py-1 rounded border border-gray-300 focus:outline-none focus:border-[#1e40af]" />
                        <button onClick={applyDateFilter}
                            className="bg-[#1e40af] hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded transition shadow-sm">ค้นหา</button>
                        <button onClick={clearDateFilter}
                            className={`bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition ${!isFilterMode ? 'hidden' : ''}`}>ล้าง</button>
                    </div>

                    <div className="text-right">
                        <p className="text-gray-600 font-semibold text-sm">{currentTime}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>
                            {status.text}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="stat-card bg-[#1e40af] text-white p-5 rounded-lg shadow-md relative overflow-hidden">
                        <div className="flex items-center gap-3 opacity-80 mb-2">
                            <FontAwesomeIcon icon={faUsers} className="text-xl" />
                            <span className="text-xs">รวมผู้รับบริการทั้งหมด (OPD Total)</span>
                        </div>
                        <AnimatedStat value={stats.opdTotal} Component="h2" className="text-3xl font-bold" />
                    </div>

                    <div className="stat-card bg-[#75cf48] text-white p-5 rounded-lg shadow-md">
                        <div className="flex items-center gap-3 opacity-80 mb-2">
                            <FontAwesomeIcon icon={faWalking} className="text-xl text-white" />
                            <span className="text-xs text-white">Walk-in (ผู้ป่วยเดินทางมาเอง)</span>
                        </div>
                        <AnimatedStat value={stats.walkIn} Component="h2" className="text-3xl font-bold" />
                    </div>

                    <div className="stat-card bg-[#e88843] text-white p-5 rounded-lg shadow-md">
                        <div className="flex items-center gap-3 opacity-80 mb-2">
                            <FontAwesomeIcon icon={faLaptopMedical} className="text-xl" />
                            <span className="text-xs">Telemedicine (รับบริการทางไกล)</span>
                        </div>
                        <AnimatedStat value={stats.telemed} Component="h2" className="text-3xl font-bold" />
                    </div>

                    <div className="stat-card bg-[#4b5563] text-white p-5 rounded-lg shadow-md">
                        <div className="flex items-center gap-3 opacity-80 mb-2">
                            <FontAwesomeIcon icon={faTruckMedical} className="text-xl text-white" />
                            <span className="text-xs">บริการส่งยา (Drug Delivery)</span>
                        </div>
                        <AnimatedStat value={stats.drugDelivery} Component="h2" className="text-3xl font-bold" />
                    </div>
                </div>

                <div className={secondaryClasses}>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
                            <p className="text-sm mb-2 font-light">รวมผู้รับบริการ<br/>ผู้ป่วยนอก</p>
                            <AnimatedStat value={stats.customOpdTotal} Component="h3" className="text-4xl font-bold" />
                        </div>
                        <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
                            <p className="text-sm mb-2 font-light">จำนวน ผู้รอรับบริการ<br/>รอซักประวัติ</p>
                            <AnimatedStat value={stats.waitingScreening} Component="h3" className="text-4xl font-bold" />
                        </div>
                        <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
                            <p className="text-sm mb-2 font-light">จำนวน รอตรวจ</p>
                            <AnimatedStat value={stats.waitingExam} Component="h3" className="text-4xl font-bold" />
                        </div>
                        <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
                            <p className="text-sm mb-2 font-light">จำนวน รอ Lab</p>
                            <AnimatedStat value={stats.waitingLab} Component="h3" className="text-4xl font-bold" />
                        </div>
                        <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
                            <p className="text-sm mb-2 font-light">จำนวน รอ X-ray</p>
                            <AnimatedStat value={stats.waitingXray} Component="h3" className="text-4xl font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                        <div className="lg:col-span-5 bg-gradient-to-br from-teal-300 via-cyan-200 to-yellow-200 p-4 rounded-3xl shadow-md">
                            <div className="grid grid-cols-2 gap-4 h-full">
                                <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                                    <p className="text-xs font-light mb-1">ระยะเวลารอคอย เฉลี่ยรวม</p>
                                    <h3 className="text-3xl font-bold text-yellow-300"><span>{stats.avgWaitAll}</span><span className="text-sm ml-1 font-normal text-white">น.</span></h3>
                                </div>
                                <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                                    <p className="text-xs font-light mb-1">ระยะเวลา รอซักประวัติ</p>
                                    <h3 className="text-3xl font-bold text-cyan-300"><span>{stats.avgWaitScreening}</span><span className="text-sm ml-1 font-normal text-white">น.</span></h3>
                                </div>
                                <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                                    <p className="text-xs font-light mb-1">ระยะเวลา รอตรวจ</p>
                                    <h3 className="text-3xl font-bold text-cyan-300"><span>{stats.avgWaitExamTotal}</span><span className="text-sm ml-1 font-normal text-white">น.</span></h3>
                                </div>
                                <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                                    <p className="text-xs font-light mb-1">ระยะเวลา รอรับยา</p>
                                    <h3 className="text-3xl font-bold text-emerald-300"><span>{stats.avgWaitPharmacy}</span><span className="text-sm ml-1 font-normal text-white">น.</span></h3>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="flex flex-col">
                                <div className="bg-[#51abbd] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center flex-grow text-center">
                                    <p className="text-sm mb-2 font-light">จำนวน รอรับยา</p>
                                    <AnimatedStat value={stats.waitingPharmacy} Component="h3" className="text-4xl font-bold" />
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <div className="bg-[#51abbd] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center flex-grow text-center">
                                    <p className="text-sm mb-2 font-light">จำนวน รอจ่ายเงิน</p>
                                    <AnimatedStat value={stats.waitingFinance} Component="h3" className="text-4xl font-bold" />
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <div className="bg-[#30c978] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center flex-grow text-center">
                                    <p className="text-sm mb-2 font-light">จำนวน กลับบ้าน</p>
                                    <AnimatedStat value={stats.goHome} Component="h3" className="text-4xl font-bold" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}