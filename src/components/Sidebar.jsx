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
  faChartLine, 
  faBed,
  faTooth
} from '@fortawesome/free-solid-svg-icons';

export default function Sidebar({ isAuthenticated, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', name: 'Overview',    icon: faChartPie,  public: true  },
    { path: '/opd',       name: 'OPD Real-time',icon: faNotesMedical, public: false },
    { path: '/gas',       name: 'Gas & Oil',    icon: faGasPump,   public: false },
    { path: '/graph',     name: 'Doctor Ops',   icon: faChartLine, public: false },
    { path: '/dental',    name: 'Dental',       icon: faTooth,     public: false },
    { path: '/beds',      name: 'Beds',         icon: faBed,       public: false }
  ];

  // แสดงเมนูทั้งหมด (การจำกัดสิทธิ์จะไปทำที่ App.jsx)
  const filteredMenu = menuItems;

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

        {/* Logout Button (Desktop) */}
        {isAuthenticated && (
          <div className="p-2 border-t border-slate-800/50">
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
          </div>
        )}
      </aside>

      {/* ======= Mobile Bottom Nav (< md) ======= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around h-16 px-2 safe-area-bottom font-['Sarabun']">
        {filteredMenu.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[60px]
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
        {/* Logout Button (Mobile) */}
        {isAuthenticated && (
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[60px] text-slate-400 hover:text-red-400"
          >
            <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-xl" />
            <span className="text-[10px] font-medium">ออกระบบ</span>
          </button>
        )}
      </nav>
    </>
  );
}