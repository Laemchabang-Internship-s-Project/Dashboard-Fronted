import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from "react-helmet-async";
import { apiGetInternal } from "../services/api";
import { DashboardStyles } from '../components/DashboardUI';
import { LiveClock } from '../components/ChartComponents';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faCircleCheck, faCircleDot, faHospital, faCalendarDays, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

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

export default function OperationRooms() {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ text: "Connecting...", type: "neutral" });
  const [roomsData, setRoomsData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── States สำหรับระบบ Filter ช่วงเวลา ──────────────────────────────────
  const [isFilterMode, setIsFilterMode] = useState(false); // เช็คว่ากำลังดูประวัติย้อนหลังอยู่ไหม
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // --- ฟังก์ชันดึงข้อมูลแบบ Real-time (โหมดปกติประจำวัน) ---
  const fetchRealtimeData = async () => {
    if (isFilterMode) return; // ถ้าอยู่ในโหมดฟิลเตอร์ประวัติ ไม่ต้องรัน Real-time ทับ
    try {
      const response = await apiGetInternal("/api/dashboard/internal/operation-rooms");
      if (response?.status === "success" && Array.isArray(response.data)) {
        // Map ให้ชื่อฟิลด์ยอดรวมตรงกัน
        const mapped = response.data.map(r => ({
          room_name: r.room_name,
          total_cases: r.total_cases_today,
          room_status: r.room_status
        }));
        setRoomsData(mapped);
        setStatus({ text: "LIVE", type: "success" });
      }
    } catch (error) {
      setStatus({ text: "ERROR", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- ฟังก์ชันดึงข้อมูลสถิติตามวันที่ผู้ใช้กำหนด (โหมด Filter) ---
  // --- ฟังก์ชันดึงข้อมูลสถิติตามวันที่ผู้ใช้กำหนด (ในไฟล์ OperationRooms.jsx) ---
  const handleFetchHistoryFilter = async (e) => {
    if (e) e.preventDefault();

    if (startDate === todayStr && endDate === todayStr) {
      setIsFilterMode(false);
      setIsLoading(true);
      await fetchRealtimeData();
      return;
    }

    // ➕ คำนวณความต่างของวันที่ผู้ใช้เลือก (Limit 1 ปี)
    const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 365) {
      alert("⚠️ สามารถเลือกช่วงเวลาดูข้อมูลย้อนหลังได้สูงสุดไม่เกิน 1 ปี (365 วัน) ครับ");
      return; // สั่งหยุดทำงานทันที ไม่ส่งคำขอไปหลังบ้าน
    }

    setIsLoading(true);
    setIsFilterMode(true);
    try {
      const response = await apiGetInternal(`/api/dashboard/internal/operation-rooms/history?start_date=${startDate}&end_date=${endDate}`);
      if (response?.status === "success" && Array.isArray(response.data)) {
        setRoomsData(response.data);
        setStatus({ text: "FILTERED", type: "neutral" });
      } else {
        setStatus({ text: "ERROR", type: "error" });
      }
    } catch (error) {
      console.error(error);
      setStatus({ text: "ERROR", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // รัน Polling ข้อมูล Real-time ปกติเฉพาะตอนไม่ได้เปิดโหมดฟิลเตอร์ย้อนหลัง
  useEffect(() => {
    if (!isFilterMode) {
      fetchRealtimeData();
      const poll = setInterval(fetchRealtimeData, 30000);
      return () => clearInterval(poll);
    }
  }, [isFilterMode]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (isFilterMode) {
      await handleFetchHistoryFilter();
    } else {
      await fetchRealtimeData();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const totalCasesSum = roomsData.reduce((sum, room) => sum + (room.total_cases || 0), 0);

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Operation Rooms - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-5 pb-20">

        {/* Header Block */}
        <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <FontAwesomeIcon icon={faHospital} className="text-teal-600 text-xl" />
              ห้องผ่าตัด {isFilterMode ? "ข้อมูลสถิติย้อนหลัง" : "Real-Time"}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {isFilterMode ? `แสดงผลยอดรวมจำนวนครั้งการผ่าตัด ในช่วงวันที่ ${startDate} ถึง ${endDate}` : "ภาพรวมยอดการใช้ห้องผ่าตัดและสถานะการทำงานปัจจุบัน"}
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

            <div className="flex flex-col items-end whitespace-nowrap"><LiveClock /></div>

            <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider ${status.type === 'success' ? 'bg-green-100 text-green-700' :
              status.text === 'FILTERED' ? 'bg-blue-100 text-blue-700' :
                status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>
              {status.text}
            </span>
          </div>
        </div>

        {/* ➕ แผงฟอร์ม Input ตัวกรองช่วงเวลา (Filter Bar) สไตล์โมเดิร์น */}
        <form onSubmit={handleFetchHistoryFilter} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4">
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
                setIsFilterMode(false);
              }}
              className="text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl px-4 py-1.5 transition-colors font-medium ml-auto shadow-sm active:scale-95 cursor-pointer"
            >
              ล้างตัวกรอง
            </button>
          )}
        </form>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    จำนวนห้องผ่าตัดทั้งหมด
                  </span>
                  
                </div>
                <div className="flex items-baseline gap-1 bg-blue-50/60 border border-blue-100 px-4 py-2 rounded-xl">
                  <AnimatedStat value={roomsData.length} className="text-[34px] font-black leading-none text-blue-600 tracking-tight" />
                  <span className="text-sm font-medium text-blue-500">ห้อง</span>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-6  bg-gradient-to-r from-white to-amber-50/20">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-gray-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    ยอดครั้งการเข้าใช้ผ่าตัดรวมในช่วงเวลานี้
                  </span>
                  
                </div>
                <div className="flex items-baseline gap-1 bg-amber-50/60 border border-amber-100 px-4 py-2 rounded-xl">
                  <AnimatedStat value={totalCasesSum} className="text-[34px] font-black leading-none text-amber-600 tracking-tight" />
                  <span className="text-sm font-medium text-amber-500">ครั้ง</span>
                </div>
              </div>
            </div>

            {/* รายชื่อห้องผ่าตัด */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {roomsData.map((room, index) => {
                  const isBusy = room.room_status === "กำลังใช้งาน";
                  return (
                    <div key={room.room_name || index} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-gray-200 transition-all">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <p className="text-[16px] font-semibold text-gray-800 leading-snug truncate" title={room.room_name}>
                          {room.room_name}
                        </p>

                        {/* แสดงป้ายสถานะเฉพาะเมื่ออยู่ในโหมด Real-time วันปัจจุบันเท่านั้น */}
                        {!isFilterMode && (
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0 ${isBusy ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            }`}>
                            <FontAwesomeIcon icon={isBusy ? faCircleDot : faCircleCheck} className={isBusy ? "animate-pulse text-red-500" : "text-emerald-500"} />
                            {room.room_status}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 mt-4 pt-3 border-t border-gray-100">
                        <div className="bg-teal-50/50 rounded-xl px-3 py-2.5 flex justify-between items-center">
                          <span className="text-xs text-teal-600 font-medium">ยอดใช้งานสะสม:</span>
                          <span className="text-xl font-black text-teal-700">
                            {room.total_cases || 0} <span className="text-xs font-normal text-teal-500">ครั้ง</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}