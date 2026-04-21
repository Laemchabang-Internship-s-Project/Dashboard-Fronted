import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faUser, faCircleCheck, faCircleXmark, faClock } from '@fortawesome/free-solid-svg-icons';

// ค่าคงที่ที่ใช้ร่วมกัน (ย้ายมาจาก GasInspection)
const STATUS_OK  = ["ปกติ", "ok", "ดี", "good", "normal", "เต็ม", "พอเพียง", "อนุมัติแล้ว", "ผ่าน"];
const STATUS_BAD = ["ผิดปกติ", "bad", "เสีย", "ไม่ปกติ", "error", "หมด", "ไม่อนุมัติ"];

const MACHINE_CAPACITY = {
  "เครื่องที่ 1": 655, "1": 655,
  "เครื่องที่ 2": 636, "2": 636,
  "เครื่องที่ 3": 650, "3": 650,
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

/**
 * FuelSummaryCard — card สรุประดับน้ำมันของเครื่องแต่ละเครื่อง
 *
 * Props:
 *  - machine    {string}   ชื่อเครื่อง เช่น "เครื่องที่ 1"
 *  - record     {object}   record ล่าสุดของเครื่องนี้จาก API
 *  - isActive   {boolean}  ไฮไลท์ card เมื่อถูกเลือก
 *  - onClick    {function} callback เมื่อ user คลิก card
 */
export default function FuelSummaryCard({ machine, record: r, isActive, onClick }) {
  if (!r) return null;

  const maxCap   = getMachineCapacity(machine);
  const rawBe4   = r.fuel_level_be4;
  const rawAft   = r.fuel_level_aft;
  const aftNum   = parseFloat(rawAft);
  const didRefuel = !isNaN(aftNum) && aftNum > 0;

  const fuelBe4  = (rawBe4 != null && rawBe4 !== "") ? rawBe4 : "—";
  const fuelAft  = didRefuel ? aftNum : "—";
  const gaugeVal = didRefuel ? rawAft : rawBe4;

  const numVal   = parseFloat(gaugeVal);
  const isValid  = !isNaN(numVal) && numVal >= 0;
  const pct      = isValid ? Math.min(Math.max(numVal / maxCap, 0), 1) : 0;
  const color    = isValid ? getFuelColor(pct) : '#cbd5e1';
  const sweepDeg = Math.round(pct * 180 * 10) / 10;
  const needleDeg = Math.round((pct * 180 - 90) * 10) / 10;

  const isApproved = r.app_name && r.app_name.trim() !== "" && r.app_name !== "—";
  const isRejected = STATUS_BAD.some(k => (r.status || "").toLowerCase().includes(k));

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 border-2 cursor-pointer transition flex flex-col items-center justify-center w-full
        ${isActive ? 'border-blue-800 shadow-md' : 'border-gray-100 hover:-translate-y-1'}`}
    >
      {/* ชื่อเครื่อง + สถานะอนุมัติ */}
      <div className="flex flex-col items-center mb-3 w-full gap-1">
        <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
          {machine}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1
          ${isRejected ? 'bg-red-100 text-red-800' : isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
        >
          <FontAwesomeIcon icon={isRejected ? faCircleXmark : isApproved ? faCircleCheck : faClock} />
          {isRejected ? 'ไม่อนุมัติ' : isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
        </span>
      </div>

      {/* Gauge */}
      <div className="mb-2 px-2 w-full max-w-[160px]">
        <div
          className="relative w-full aspect-[2/1] rounded-t-full overflow-hidden bg-slate-200 mx-auto"
          style={{ '--gauge-color': color, '--gauge-deg': sweepDeg + 'deg', '--needle-deg': needleDeg + 'deg' }}
        >
          <div className="absolute inset-0 w-full h-full"
            style={{ background: `conic-gradient(from 270deg at 50% 100%, var(--gauge-color) 0deg, var(--gauge-color) var(--gauge-deg), transparent var(--gauge-deg))` }}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[68%] aspect-[2/1] rounded-t-full bg-white z-10" />
          <div className="absolute bottom-0 left-1/2 origin-bottom-center w-[3px] h-[44%] bg-slate-700 rounded-full z-20"
            style={{ transform: `translateX(-50%) rotate(var(--needle-deg))` }}
          />
          <div className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 w-[28%] aspect-square rounded-full bg-white border-[3px] border-slate-200 z-30" />
        </div>
        <div className="flex justify-center items-baseline gap-1 mt-1 text-center">
          <span style={{ color: isValid ? color : '#94a3b8' }} className="text-base font-black">
            {isValid ? numVal : '—'}
          </span>
          <span className="text-[10px] text-gray-400">/ {maxCap} L</span>
        </div>
      </div>

      {/* ก่อน → หลัง */}
      <div className="flex items-center gap-3 mt-1 justify-center w-full">
        <div className="text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-tighter">ก่อน</p>
          <p className="text-sm font-bold text-slate-600">{fuelBe4 !== "—" ? fuelBe4 + " L" : "—"}</p>
        </div>
        <span className="text-gray-300 text-xs">→</span>
        <div className="text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-tighter">หลัง</p>
          <p className={`text-sm font-bold ${didRefuel ? 'text-green-600' : 'text-gray-400'}`}>
            {fuelAft !== "—" ? fuelAft + " L" : "—"}
          </p>
        </div>
      </div>

      {/* วันที่ + ผู้ตรวจ */}
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
}
