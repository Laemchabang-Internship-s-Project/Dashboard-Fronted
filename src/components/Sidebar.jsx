import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNotesMedical, faGasPump, faBars } from '@fortawesome/free-solid-svg-icons';

export default function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', name: 'OPD Real-time', icon: faNotesMedical },
    { path: '/gas', name: 'Gas & Oil', icon: faGasPump }
  ];

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-[#1e40af] text-white shadow-xl transition-all duration-300 ease-in-out z-50 overflow-hidden flex flex-col ${isOpen ? 'w-64' : 'w-16'}`}>
      <div 
        className="flex items-center h-16 border-b border-blue-800 px-5 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-6 flex justify-center">
          <FontAwesomeIcon icon={faBars} className="text-xl" />
        </div>
        <span className={`ml-4 font-bold text-xl whitespace-nowrap transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
          LCBH Dashboards
        </span>
      </div>
      <div className="flex-1 py-4 flex flex-col gap-2">
        {menuItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center px-5 py-3 transition-colors duration-200 ${isActive ? 'bg-blue-800 border-l-4 border-blue-400' : 'hover:bg-blue-800 border-l-4 border-transparent'}`}
            >
              <div className="w-6 flex justify-center">
                <FontAwesomeIcon icon={item.icon} className="text-lg" />
              </div>
              <span className={`ml-4 whitespace-nowrap transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}