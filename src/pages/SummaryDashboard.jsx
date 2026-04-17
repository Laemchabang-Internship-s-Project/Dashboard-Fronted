import React, { useState, useEffect } from 'react';

const API_URL = "http://localhost:8000";
const API_KEY = "";

export default function SummaryDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ text: 'Connecting...', color: 'bg-gray-200 text-gray-800' });
  const [currentTime, setCurrentTime] = useState('');
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('th-TH', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSnapshot = async () => {
    if (isFilterMode) return;
    try {
      const res = await fetch(`${API_URL}/api/dashboard/snapshot`, {
        headers: API_KEY ? { "x-api-key": API_KEY } : {}
      });
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Snapshot error:", err);
    }
  };

  useEffect(() => {
    if (isFilterMode) return;
    
    loadSnapshot();
    
    let url = `${API_URL}/api/dashboard/stream`;
    if (API_KEY) url += `?api_key=${API_KEY}`;
    
    const es = new EventSource(url);
    
    es.onopen = () => setStatus({ text: "LIVE", color: "bg-green-100 text-green-700 font-bold" });
    es.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        setData(newData);
      } catch (e) {}
    };
    es.onerror = () => {
      setStatus({ text: "RECONNECTING", color: "bg-orange-100 text-orange-700" });
    };

    return () => es.close();
  }, [isFilterMode]);

  const applyDateFilter = async () => {
    if (!startDate || !endDate) return alert('กรุณาเลือกวันที่ให้ครบถ้วน');
    setIsFilterMode(true);
    setStatus({ text: "FILTERED (HISTORY)", color: "bg-purple-100 text-purple-700 font-bold" });

    try {
      const res = await fetch(`${API_URL}/api/dashboard/summary-range?start_date=${startDate}&end_date=${endDate}`, {
        headers: API_KEY ? { "x-api-key": API_KEY } : {}
      });
      const responseData = await res.json();
      
      setData(prev => ({
        ...prev,
        system: {
          ...prev?.system,
          total_OPD: responseData.data.opd_total ?? 0,
          total_walkin: responseData.data.walk_in ?? 0,
          hos_telemed: responseData.data.telemed ?? 0,
          total_drug_delivery: responseData.data.drug_delivery ?? 0
        }
      }));
    } catch (err) {
      console.error("Filter fetch error:", err);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลย้อนหลัง");
    }
  };

  const clearDateFilter = () => {
    setIsFilterMode(false);
    setStartDate('');
    setEndDate('');
    setStatus({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });
  };

  const formatWaitTime = (minutes) => {
    if (minutes == null || isNaN(minutes)) return "-";
    if (minutes < 60) return Number(minutes).toFixed(1);
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs} ชม. ${mins}`;
  };

  const h = data?.opd_clinics?.header;
  const s = data?.system;
  const rooms = data?.opd_clinics?.rooms || [];
  const room010 = rooms.find(r => r.room_code === '010');

  const waitScreening = room010?.avg_wait_minutes || 0;
  const waitExam = data?.summary?.avg_wait_examination || 0;
  const waitPharmacy = data?.technical_services?.pharmacy?.avg_wait_minutes || 0;
  const totalAvgWait = waitScreening + waitExam + waitPharmacy;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center mb-6 bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-white/40">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">แดชบอร์ดสรุป</h1>
          <p className="text-gray-400 text-sm mt-1">การให้บริการต่าง ๆ</p>
        </div>

        <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-lg border border-gray-200 shadow-sm my-4 lg:my-0">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm px-2 py-1 rounded border border-gray-300 focus:outline-none focus:border-[#1e40af]" />
          <span className="text-gray-500 text-sm">-</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm px-2 py-1 rounded border border-gray-300 focus:outline-none focus:border-[#1e40af]" />
          <button onClick={applyDateFilter} className="bg-[#1e40af] hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded transition shadow-sm">ค้นหา</button>
          {isFilterMode && <button onClick={clearDateFilter} className="bg-gray-400 hover:bg-gray-500 text-white text-sm px-3 py-1.5 rounded transition">ล้าง</button>}
        </div>

        <div className="text-right">
          <p className="text-gray-600 font-semibold text-sm mb-1">{currentTime}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1e40af] text-white p-5 rounded-lg shadow-md transition hover:-translate-y-1">
          <div className="flex items-center gap-3 opacity-80 mb-2">
            <span className="text-xs">รวมผู้รับบริการทั้งหมด (OPD Total)</span>
          </div>
          <h2 className="text-3xl font-bold">{s?.total_OPD ?? '-'}</h2>
        </div>
        <div className="bg-[#75cf48] text-white p-5 rounded-lg shadow-md transition hover:-translate-y-1">
          <div className="flex items-center gap-3 opacity-80 mb-2">
            <span className="text-xs">Walk-in (ผู้ป่วยเดินทางมาเอง)</span>
          </div>
          <h2 className="text-3xl font-bold">{s?.total_walkin ?? '-'}</h2>
        </div>
        <div className="bg-[#e88843] text-white p-5 rounded-lg shadow-md transition hover:-translate-y-1">
          <div className="flex items-center gap-3 opacity-80 mb-2">
            <span className="text-xs">Telemedicine (รับบริการทางไกล)</span>
          </div>
          <h2 className="text-3xl font-bold">{s?.hos_telemed ?? '-'}</h2>
        </div>
        <div className="bg-[#4b5563] text-white p-5 rounded-lg shadow-md transition hover:-translate-y-1">
          <div className="flex items-center gap-3 opacity-80 mb-2">
            <span className="text-xs">บริการส่งยา (Drug Delivery)</span>
          </div>
          <h2 className="text-3xl font-bold">{s?.total_drug_delivery ?? '-'}</h2>
        </div>
      </div>

      <div className={`transition-all duration-300 ${isFilterMode ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
            <p className="text-sm mb-2 font-light">รวมผู้รับบริการ<br/>ผู้ป่วยนอก</p>
            <h3 className="text-4xl font-bold">{h?.custom_opd_total ?? '-'}</h3>
          </div>
          <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
            <p className="text-sm mb-2 font-light">จำนวน ผู้รอรับบริการ<br/>รอซักประวัติ</p>
            <h3 className="text-4xl font-bold">{h?.waiting_screening ?? '-'}</h3>
          </div>
          <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
            <p className="text-sm mb-2 font-light">จำนวน รอตรวจ</p>
            <h3 className="text-4xl font-bold">{h?.waiting_exam ?? '-'}</h3>
          </div>
          <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
            <p className="text-sm mb-2 font-light">จำนวน รอ Lab</p>
            <h3 className="text-4xl font-bold">{data?.technical_services?.lab?.waiting ?? '-'}</h3>
          </div>
          <div className="bg-[#1e3a8a] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[140px] text-center">
            <p className="text-sm mb-2 font-light">จำนวน รอ X-ray</p>
            <h3 className="text-4xl font-bold">{data?.technical_services?.xray?.waiting ?? '-'}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          <div className="lg:col-span-5 bg-gradient-to-br from-teal-300 via-cyan-200 to-yellow-200 p-4 rounded-3xl shadow-md">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                <p className="text-xs font-light mb-1">ระยะเวลารอคอย เฉลี่ยรวม</p>
                <h3 className="text-3xl font-bold text-yellow-300">{formatWaitTime(totalAvgWait)}<span className="text-sm ml-1 font-normal text-white">น.</span></h3>
              </div>
              <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                <p className="text-xs font-light mb-1">ระยะเวลา รอซักประวัติ</p>
                <h3 className="text-3xl font-bold text-cyan-300">{formatWaitTime(waitScreening)}<span className="text-sm ml-1 font-normal text-white">น.</span></h3>
              </div>
              <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                <p className="text-xs font-light mb-1">ระยะเวลา รอตรวจ</p>
                <h3 className="text-3xl font-bold text-cyan-300">{formatWaitTime(waitExam)}<span className="text-sm ml-1 font-normal text-white">น.</span></h3>
              </div>
              <div className="bg-[#2c4c82] text-white rounded-2xl flex flex-col items-center justify-center p-4 min-h-[120px] text-center shadow-sm">
                <p className="text-xs font-light mb-1">ระยะเวลา รอรับยา</p>
                <h3 className="text-3xl font-bold text-emerald-300">{formatWaitTime(waitPharmacy)}<span className="text-sm ml-1 font-normal text-white">น.</span></h3>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#51abbd] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center">
              <p className="text-sm mb-2 font-light">จำนวน รอรับยา</p>
              <h3 className="text-4xl font-bold">{data?.technical_services?.pharmacy?.waiting ?? '-'}</h3>
            </div>
            <div className="bg-[#51abbd] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center">
              <p className="text-sm mb-2 font-light">จำนวน รอจ่ายเงิน</p>
              <h3 className="text-4xl font-bold">{data?.technical_services?.finance?.waiting ?? '-'}</h3>
            </div>
            <div className="bg-[#30c978] text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center">
              <p className="text-sm mb-2 font-light">จำนวน กลับบ้าน</p>
              <h3 className="text-4xl font-bold">{s?.hos_go_home ?? '-'}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}