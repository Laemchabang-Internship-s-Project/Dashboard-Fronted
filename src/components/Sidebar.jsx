import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faNotesMedical,
  faGasPump,
  faBars,
  faChartPie,
  faChevronLeft,
  faArrowRightFromBracket,
  faArrowRightToBracket, // เพิ่ม Icon สำหรับ Login
  faChartLine,
  faBed,
  faTooth,
  faBrain,
  faSkullCrossbones
} from '@fortawesome/free-solid-svg-icons';

export default function Sidebar({ isAuthenticated, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', name: 'Overview', icon: faChartPie, public: true },
    { path: '/opd', name: 'OPD Real-time', icon: faNotesMedical, public: false },
    { path: '/gas', name: 'Gas & Oil', icon: faGasPump, public: false },
    { path: '/graph', name: 'Doctor Ops', icon: faChartLine, public: false },
    { path: '/dental', name: 'Dental', icon: faTooth, public: false },
    { path: '/depression', name: 'Depression', icon: faBrain, public: false },
    { path: '/death', name: 'Death', icon: faSkullCrossbones, public: false },
    { path: '/beds', name: 'Beds', icon: faBed, public: false }
  ];

  // กรองเมนู: ถ้าล็อกอินแล้วเห็นทั้งหมด ถ้ายังให้เห็นแค่ public
  const filteredMenu = isAuthenticated ? menuItems : menuItems.filter(item => item.public);

  return (
    <>
      {/* ======= Desktop Sidebar (md ขึ้นไป) ======= */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 h-screen bg-[#0f172a] text-slate-300 shadow-2xl transition-all duration-200 z-50 flex-col overflow-hidden font-['Sarabun'] ${isOpen ? 'w-64' : 'w-16'}`}
      >
        <div className="relative flex items-center h-16 px-4.5 border-b border-slate-800/50 mb-2">
          <div className="cursor-pointer hover:text-white transition-colors duration-200" onClick={() => setIsOpen(!isOpen)}>
            <FontAwesomeIcon icon={isOpen ? faChevronLeft : faBars} className="text-xl" />
          </div>
          <div className={`ml-4 transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <span className="font-bold text-lg text-white whitespace-nowrap">LCBH Dashboards</span>
          </div>
        </div>

        <nav className="flex-1 px-1 space-y-2">
          {filteredMenu.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                group flex items-center h-13 px-4 rounded-xl transition-all duration-200
                ${isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'hover:bg-slate-800/50 hover:text-slate-100'}
              `}
            >
              {({ isActive }) => (
                <>
                  <div className="w-5 flex justify-center items-center shrink-0">
                    <FontAwesomeIcon icon={item.icon} className={`text-xl ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  </div>
                  <span className={`ml-3 text-base transition-all duration-200 whitespace-nowrap ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Login / Logout Button (Desktop) */}
        <div className="p-2 border-t border-slate-800/50">
          {isAuthenticated ? (
            <button
              onClick={onLogout}
              className="w-full group flex items-center h-11 px-3 rounded-xl transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 text-slate-400"
            >
              <div className="w-5 flex justify-center items-center shrink-0">
                <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-base group-hover:text-red-400" />
              </div>
              <span className={`ml-3 text-sm transition-all duration-200 whitespace-nowrap font-['Sarabun'] ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                ออกจากระบบ
              </span>
            </button>
          ) : (
            <NavLink
              to="/login"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `w-full group flex items-center h-11 px-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'hover:bg-blue-500/10 hover:text-blue-400 text-slate-400'}`}
            >
              <div className="w-5 flex justify-center items-center shrink-0">
                <FontAwesomeIcon icon={faArrowRightToBracket} className="text-base group-hover:text-blue-400" />
              </div>
              <span className={`ml-3 text-sm transition-all duration-200 whitespace-nowrap font-['Sarabun'] ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                เข้าสู่ระบบ
              </span>
            </NavLink>
          )}
        </div>
      </aside>

      {/* ======= Mobile Bottom Nav (< md) ======= */}
      {/* แก้ไขส่วนนี้: เปลี่ยน flex, ซ่อน scrollbar, เว้นระยะด้วย gap-2 */}
      {/* ======= Mobile Bottom Nav (< md) ======= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-slate-800 flex items-center h-16 px-4 safe-area-bottom font-['Sarabun'] ${isAuthenticated
          ? "overflow-x-auto gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          : "justify-between"
        }`}>

        {/* 1. เพิ่ม Invisible Spacer เฉพาะตอนยังไม่ Login เพื่อดัน Overview ให้ไปอยู่ตรงกลางพอดี */}
        {!isAuthenticated && <div className="min-w-[72px] shrink-0" />}

        {filteredMenu.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
        flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 min-w-[72px] shrink-0
        ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}
      `}
          >
            {({ isActive }) => (
              <>
                <FontAwesomeIcon icon={item.icon} className={`text-xl ${isActive ? 'text-blue-400' : ''}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Login / Logout Button (Mobile) */}
        {isAuthenticated ? (
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 min-w-[72px] shrink-0 text-slate-400 hover:text-red-400"
          >
            <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-xl" />
            <span className="text-[10px] font-medium">ออกระบบ</span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-200 min-w-[72px] shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'}`}
          >
            <FontAwesomeIcon icon={faArrowRightToBracket} className="text-xl" />
            <span className="text-[10px] font-medium">เข้าระบบ</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}