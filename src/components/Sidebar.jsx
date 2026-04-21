import React, { useState, useEffect } from 'react'; // เพิ่ม useEffect
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNotesMedical, faGasPump, faBars, faChartPie, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { checkNetwork } from '../services/api'; // Import ฟังก์ชันเช็คเน็ต

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInternal, setIsInternal] = useState(false); // State เก็บสถานะคนใน/คนนอก

  useEffect(() => {
    checkNetwork().then(setIsInternal);
  }, []);

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard รวม', icon: faChartPie, public: true }, // หน้าที่ให้คนนอกดูได้
    { path: '/opd', name: 'OPD Real-time', icon: faNotesMedical, public: false },
    { path: '/gas', name: 'Gas & Oil', icon: faGasPump, public: false }
  ];

  // กรองเมนู: ถ้าไม่ใช่คนใน ให้เห็นเฉพาะรายการที่ public: true
  const filteredMenu = menuItems.filter(item => isInternal || item.public);

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-[#0f172a] text-slate-300 shadow-2xl transition-all duration-200 z-50 flex flex-col overflow-hidden ${isOpen ? 'w-72' : 'w-20'}`}
    >
      <div className="relative flex items-center h-20 px-6 border-b border-slate-800/50 mb-4">
        <div className="cursor-pointer hover:text-white transition-colors duration-200" onClick={() => setIsOpen(!isOpen)}>
          <FontAwesomeIcon icon={isOpen ? faChevronLeft : faBars} className="text-xl" />
        </div>
        <div className={`ml-6 transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          <span className="font-bold text-xl text-white whitespace-nowrap">LCBH Dashboards</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-2">
        {filteredMenu.map(item => (
          <NavLink 
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)} 
            className={({ isActive }) => `
              group flex items-center h-12 px-4 rounded-xl transition-all duration-200
              ${isActive ? 'bg-blue-600/10 text-blue-400 font-semibold' : 'hover:bg-slate-800/50 hover:text-slate-100'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className="w-6 flex justify-center items-center">
                  <FontAwesomeIcon icon={item.icon} className={`text-lg ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                </div>
                <span className={`ml-4 transition-all duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none'}`}>
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