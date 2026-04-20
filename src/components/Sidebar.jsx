import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNotesMedical, faGasPump, faBars, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

// ... (import ส่วนเดิม)

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: '/opd', name: 'OPD Real-time', icon: faNotesMedical },
    { path: '/gas', name: 'Gas & Oil', icon: faGasPump }
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-[#0f172a] text-slate-300 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-50 flex flex-col ${isOpen ? 'w-72' : 'w-20'}`}
    >
      {/* Header */}
      <div className="relative flex items-center h-20 px-6 border-b border-slate-800/50 mb-4">
        <div 
          className="cursor-pointer hover:text-white transition-colors duration-200"
          onClick={() => setIsOpen(!isOpen)}
        >
          <FontAwesomeIcon icon={isOpen ? faChevronLeft : faBars} className="text-xl" />
        </div>
        <div className={`ml-6 transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          <span className="font-bold text-xl text-white whitespace-nowrap">LCBH Dashboards</span>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-3 space-y-2">
        {menuItems.map(item => (
          <NavLink 
            key={item.path}
            to={item.path}
            // เพิ่มบรรทัดนี้ เพื่อให้ปิด sidebar ทันทีที่คลิกเลือกเมนู
            onClick={() => setIsOpen(false)} 
            className={({ isActive }) => `
              group flex items-center h-12 px-4 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-blue-600/10 text-blue-400 font-semibold' 
                : 'hover:bg-slate-800/50 hover:text-slate-100'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className="w-6 flex justify-center items-center">
                  <FontAwesomeIcon icon={item.icon} className={`text-lg ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                </div>
                <span className={`ml-4 whitespace-nowrap transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}