import React, { useState, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import GasInspection from './pages/GasInspection';
import SummarOPD from './pages/SummaryOPD';
import NotFound from './pages/NotFound';

function PasswordPrompt({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'EA0010823') {
      onAuthenticate();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full flex-1 pt-16 md:pt-32 pb-8 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 font-['Sarabun']">กรุณาใส่รหัสผ่าน</h2>
          <p className="text-sm text-gray-500 mt-2 font-['Sarabun']">เพื่อเข้าถึงข้อมูลภายใน</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="รหัสผ่าน"
              className={`w-full px-4 py-3 border rounded-xl font-['Sarabun'] transition-all duration-200 outline-none ${error ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-200' : 'border-gray-300 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2 font-['Sarabun'] text-center">รหัสผ่านไม่ถูกต้อง</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-['Sarabun'] font-medium py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md hover:shadow-lg"
          >
            ยืนยัน
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedRoute({ isAuthenticated, onAuthenticate, children }) {
  if (!isAuthenticated) {
    return <PasswordPrompt onAuthenticate={onAuthenticate} />;
  }
  return children;
}

function MainLayout() {
  const [toastPosition, setToastPosition] = useState(
    window.innerWidth < 768 ? 'top-right' : 'bottom-right'
  );

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setToastPosition('top-right');
      } else {
        setToastPosition('bottom-right');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex w-full bg-[#f1f5f9] font-['Sarabun'] min-h-screen">
      <Toaster position={toastPosition} reverseOrder={false} />
      <Sidebar />
      <main className="flex-1 w-full md:pl-16 transition-all duration-300 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('dashboard_auth_EA') === 'true';
  });

  const handleAuthenticate = () => {
    localStorage.setItem('dashboard_auth_EA', 'true');
    setIsAuthenticated(true);
  };

  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* หน้าแรก: ไป /dashboard (เปิดให้ดู Overview ฟรีโดยไม่ต้องล๊อกอิน) หรือไป /opd ได้เลย */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* หน้าที่ใครๆ ก็ดูได้ */}
        <Route path="/dashboard" element={<Overview />} />

        {/* หน้าที่ต้องใส่รหัสผ่าน */}
        <Route path="/gas" element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onAuthenticate={handleAuthenticate}>
            <GasInspection />
          </ProtectedRoute>
        } />
        <Route path="/opd" element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onAuthenticate={handleAuthenticate}>
            <SummarOPD />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;