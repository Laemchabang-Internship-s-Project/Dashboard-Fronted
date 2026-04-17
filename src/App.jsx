import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNotesMedical, faGasPump, faBars } from '@fortawesome/free-solid-svg-icons';
import SummaryDashboard from './pages/SummaryDashboard';
import GasInspection from './pages/GasInspection';

function Sidebar() {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { path: '/', name: 'OPD Real-time', icon: faNotesMedical },
    { path: '/gas', name: 'Gas & Oil', icon: faGasPump }
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-[#1e40af] text-white shadow-xl transition-all duration-300 ease-in-out z-50 overflow-hidden flex flex-col ${isHovered ? 'w-64' : 'w-16'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center h-16 border-b border-blue-800 px-5">
        <div className="w-6 flex justify-center">
          <FontAwesomeIcon icon={faBars} className="text-xl" />
        </div>
        <span className={`ml-4 font-bold text-xl whitespace-nowrap transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
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
              className={`flex items-center px-5 py-3 transition-colors duration-200 ${isActive ? 'bg-blue-800 border-l-4 border-blue-400' : 'hover:bg-blue-800 border-l-4 border-transparent'}`}
            >
              <div className="w-6 flex justify-center">
                <FontAwesomeIcon icon={item.icon} className="text-lg" />
              </div>
              <span className={`ml-4 whitespace-nowrap transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="flex bg-[#f1f5f9] font-['Sarabun'] min-h-screen">
        <Sidebar />
        <main className="flex-1 pl-16 transition-all duration-300 overflow-x-hidden min-h-screen pb-10">
          <Routes>
            <Route path="/" element={<SummaryDashboard />} />
            <Route path="/gas" element={<GasInspection />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;