import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGetInternal } from "../services/api";
import { DashboardStyles } from '../components/DashboardUI';
import { LiveClock } from '../components/ChartComponents';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faCircleCheck, faCircleDot, faHospital } from '@fortawesome/free-solid-svg-icons';

// ─── AnimatedStat Component (เอฟเฟกต์ตัวเลขวิ่งตอนอัปเดต) ──────────────────────
const AnimatedStat = ({ value, suffix = "", className = "" }) => {
  const [display, setDisplay] = useState("-");
  const frameRef = useRef(null);

  useEffect(() => {
    if (value === "-" || value == null || isNaN(value)) {
      setDisplay(value || "-");
      return;
    }
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

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function OperationRooms() {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ text: "Connecting...", type: "neutral" });
  const [roomsData, setRoomsData] = useState([]);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- ฟังก์ชันดึงข้อมูลจาก API ตัวจัดการ Cache ---
  const fetchOperationRoomsData = async () => {
    try {
      // เรียกใช้เอนพอยต์ผ่านโมดูลหลักของระบบ
      const response = await apiGetInternal("/api/dashboard/internal/operation-rooms");

      if (response?.status === "success" && Array.isArray(response.data)) {
        setRoomsData(response.data);
        setStatus({ text: "LIVE", type: "success" });
      } else {
        setStatus({ text: "ERROR", type: "error" });
      }
    } catch (error) {
      console.error("Error fetching operation rooms data:", error);
      setStatus({ text: "ERROR", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- จัดการรัน Polling ทุก 30 วินาทีเพื่อความ Real-time ---
  useEffect(() => {
    fetchOperationRoomsData();
    const poll = setInterval(fetchOperationRoomsData, 30000);
    return () => clearInterval(poll);
  }, []);

  // --- ปุ่มกดดึงข้อมูลแบบ Manual ---
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOperationRoomsData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // --- คำนวณยอดทางสถิติหลังบ้านรวมสำหรับ KPI Card ด้านบน ---
  const totalRoomsCount = roomsData.length;
  const activeRoomsCount = roomsData.filter(room => room.room_status === "กำลังใช้งาน").length;
  const availableRoomsCount = totalRoomsCount - activeRoomsCount;
  
  const totalCasesTodaySum = roomsData.reduce((sum, room) => sum + (room.total_cases_today || 0), 0);

  // --- ระบบ Filter กรองรายชื่อห้องผ่าตัด ---
  const filteredRooms = selectedRoomFilter === "all"
    ? roomsData
    : roomsData.filter(room => room.room_name === selectedRoomFilter);

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Operation Rooms - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-5 pb-20">

        {/* Header Block สไตล์ Glassmorphism */}
        <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
              
              ห้องผ่าตัด Real-Time
            </h1>
            <p className="text-gray-400 text-sm mt-1">ภาพรวมยอดการใช้ห้องผ่าตัดและสถานะการทำงานปัจจุบัน</p>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            {/* ปุ่มกดรีเฟรชข้อมูล */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl hover:bg-white hover:text-teal-600 hover:border-teal-200 hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* ปุ่มเปิดตัวคัดกรองตัวเลือกห้องผ่าตัด (Room Picker) */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white/50 border border-gray-200 rounded-xl px-4 py-2 text-[13px] text-gray-700 shadow-sm hover:bg-white transition-colors flex items-center gap-2 max-w-[200px]"
            >
              <span className="truncate">{selectedRoomFilter === "all" ? "ดูทั้งหมด" : selectedRoomFilter}</span>
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* แสดงเวลาปัจจุบันระบบ */}
            <div className="flex flex-col items-end whitespace-nowrap"><LiveClock /></div>
            
            {/* สถานะสัญญาณ Live แบ็กเอนด์ */}
            <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${
              status.type === 'success' ? 'bg-green-100 text-green-700' :
              status.type === 'error' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {status.text}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
          </div>
        ) : (
          <>
            {/* แผง KPI Cards สรุปยอดรวมด้านบน */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">ห้องผ่าตัดทั้งหมด</span>
                <AnimatedStat value={totalRoomsCount} className="text-[30px] font-semibold leading-none text-blue-600" />
                <span className="text-[11px] text-gray-300">Total rooms</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">กำลังใช้งาน</span>
                <AnimatedStat value={activeRoomsCount} className="text-[30px] font-semibold leading-none text-rose-500" />
                <span className="text-[11px] text-gray-300">Active rooms</span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-1 bg-rose-400 rounded-full transition-all duration-700" style={{ width: `${Math.round((activeRoomsCount / totalRoomsCount) * 100) || 0}%` }} />
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">ห้องว่างคงเหลือ</span>
                <AnimatedStat value={availableRoomsCount} className="text-[30px] font-semibold leading-none text-emerald-500" />
                <span className="text-[11px] text-gray-300">Available rooms</span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className="h-1 bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${Math.round((availableRoomsCount / totalRoomsCount) * 100) || 0}%` }} />
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
                <span className="text-[12px] text-gray-400">ยอดเคสผ่าตัดวันนี้รวม</span>
                <AnimatedStat value={totalCasesTodaySum} suffix=" ราย" className="text-[30px] font-semibold leading-none text-amber-500" />
                <span className="text-[11px] text-gray-300">Total cases today</span>
              </div>
            </div>

            {/* ส่วนแสดงสถานะแยกรายห้องผ่าตัด */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-[3px] h-[14px] bg-teal-600 rounded-full" />
                <h2 className="text-[13px] font-medium text-gray-500">สถานะแยกตามห้องผ่าตัด</h2>
              </div>

              {filteredRooms.length === 0 ? (
                <div className="text-center py-16 text-gray-300 text-sm">ไม่พบข้อมูลห้องผ่าตัดในระบบ</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredRooms.map((room, index) => {
                    const isBusy = room.room_status === "กำลังใช้งาน";
                    
                    const borderStatusClass = isBusy ? "border-red-100 hover:border-red-200" : "border-emerald-100 hover:border-emerald-200";
                    const bgBadgeColor = isBusy ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200";
                    const statusIcon = isBusy ? faCircleDot : faCircleCheck;
                    const animatePulseClass = isBusy ? "animate-pulse text-red-500" : "text-emerald-500";

                    return (
                      <div key={room.room_name || index} className={`bg-white border rounded-2xl p-4 shadow-sm transition-all ${borderStatusClass}`}>
                        {/* ส่วนชื่อห้องและสถานะ */}
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <p className="text-[16px] font-semibold text-gray-800 leading-snug truncate" title={room.room_name}>
                            {room.room_name}
                          </p>
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${bgBadgeColor}`}>
                            <FontAwesomeIcon icon={statusIcon} className={animatePulseClass} />
                            {room.room_status}
                          </span>
                        </div>

                        {/* สถิติจำนวนเคสการใช้ห้อง */}
                        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
                          <div className="bg-gray-50/80 rounded-xl px-2 py-2 flex flex-col justify-center">
                            <p className="text-[11px] text-gray-400">สถานะปัจจุบัน</p>
                            <p className={`text-[13px] font-medium mt-0.5 ${isBusy ? "text-red-600" : "text-emerald-600"}`}>
                              {isBusy ? "ไม่ว่าง" : "พร้อมใช้งาน"}
                            </p>
                          </div>
                          <div className="bg-teal-50/50 rounded-xl px-2 py-2 text-center">
                            <p className="text-[18px] font-bold text-teal-700 leading-none">
                              {room.total_cases_today || 0}
                            </p>
                            <p className="text-[10px] text-teal-500 mt-1">เคสวันนี้</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal หน้าต่างเลือกห้อง (Room Filter Picker) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          style={{ fontFamily: "'Sarabun', sans-serif" }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-[16px] font-semibold text-gray-800">เลือกห้องผ่าตัด</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-3 space-y-1">
              <button
                onClick={() => { setSelectedRoomFilter("all"); setIsModalOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all ${selectedRoomFilter === "all"
                  ? "bg-teal-50 text-teal-700 font-semibold border border-teal-100"
                  : "hover:bg-gray-50 text-gray-700 border border-transparent"
                }`}
              >
                ดูทั้งหมด
              </button>
              
              {roomsData.map((room, index) => (
                <button
                  key={room.room_name || index}
                  onClick={() => { setSelectedRoomFilter(room.room_name); setIsModalOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all ${selectedRoomFilter === room.room_name
                    ? "bg-teal-50 text-teal-700 font-semibold border border-teal-100"
                    : "hover:bg-gray-50 text-gray-700 border border-transparent"
                  }`}
                >
                  {room.room_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}