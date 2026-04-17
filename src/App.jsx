import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import SummaryDashboard from './pages/SummaryDashboard';
import GasInspection from './pages/GasInspection';

const Sidebar = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <aside className="w-64 bg-[#1e40af] text-white flex-shrink-0 hidden md:flex flex-col min-h-screen">
      <div className="p-6 font-bold text-xl border-b border-blue-800">
        LCBH Dashboard
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link
          to="/"
          className={`block px-4 py-2 rounded-lg transition ${
            path === '/' ? 'bg-blue-800' : 'hover:bg-blue-700'
          }`}
        >
        Dashboard
        </Link>
        <Link
          to="/gas-inspection"
          className={`block px-4 py-2 rounded-lg transition ${
            path === '/gas-inspection' ? 'bg-blue-800' : 'hover:bg-blue-700'
          }`}
        >
        Gas Inspection
        </Link>
      </nav>
      <div className="p-4 text-xs text-blue-300 border-t border-blue-800">
        ระบบอัปเดตอัตโนมัติ (Real-time)
      </div>
    </aside>
  );
};

function App() {
  return (
    <BrowserRouter basename="/lcbh/dashboard">
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <Sidebar />
        <main className="flex-1 overflow-y-auto h-screen">
          <Routes>
            <Route path="/" element={<SummaryDashboard />} />
            <Route path="/gas-inspection" element={<GasInspection />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;