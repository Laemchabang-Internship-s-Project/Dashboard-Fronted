import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import LogoutModal from './components/LogoutModal';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import GasInspection from './pages/GasInspection';
import SummarOPD from './pages/SummaryOPD';
import Graph from './pages/Graph';
import BedDashboard from './pages/Bed';
import NotFound from './pages/NotFound';
import { authLogin, authVerify } from './services/api';

// ─── Token Helpers ───────────────────────────────────────────────────────────
const TOKEN_KEY = 'dashboard_token';
const getToken = () => sessionStorage.getItem(TOKEN_KEY);
const setToken = (t) => sessionStorage.setItem(TOKEN_KEY, t);
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

// ─── PasswordPrompt Component ─────────────────────────────────────────────────
function PasswordPrompt({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ ส่ง password ไป Backend ให้ตรวจ — ไม่มีรหัสผ่านใน Frontend เลย
      const data = await authLogin(password);
      setToken(data.access_token);
      onAuthenticate();
    } catch (err) {
      if (err.status === 401) {
        setError('รหัสผ่านไม่ถูกต้อง');
      } else if (err.status === 429) {
        setError(' กรุณารอ 1 นาที');
      } else {
        setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen px-4 pb-20 md:pb-0">
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
              maxLength={128}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="รหัสผ่าน"
              className={`w-full px-4 py-3 border rounded-xl font-['Sarabun'] transition-all duration-200 outline-none ${error ? 'border-red-500 bg-red-50 focus:ring-2 focus:ring-red-200' : 'border-gray-300 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'}`}
              autoFocus
              disabled={loading}
            />
            {error && <p className="text-red-500 text-sm mt-2 font-['Sarabun'] text-center">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 text-white font-['Sarabun'] font-medium py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── ProtectedRoute Component ─────────────────────────────────────────────────
function ProtectedRoute({ isAuthenticated, onAuthenticate, children }) {
  if (!isAuthenticated) {
    return <PasswordPrompt onAuthenticate={onAuthenticate} />;
  }
  return children;
}

// ─── MainLayout Component ─────────────────────────────────────────────────────
function MainLayout({ isAuthenticated, onLogout }) {
  const [toastPosition, setToastPosition] = useState(
    window.innerWidth < 768 ? 'top-right' : 'bottom-right'
  );

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleRequestLogout = () => setShowLogoutModal(true);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };
  const handleCancelLogout = () => setShowLogoutModal(false);

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
      <Sidebar isAuthenticated={isAuthenticated} onLogout={handleRequestLogout} />
      <main className="flex-1 w-full md:pl-16 transition-all duration-300 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <LogoutModal
        open={showLogoutModal}
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
      />
    </div>
  );
}

// ─── App Component ─────────────────────────────────────────────────────────────
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true); // ตรวจ token ตอน mount

  // ตอน reload หน้า — ตรวจว่า token ที่เก็บไว้ยังใช้ได้อยู่หรือเปล่า
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsVerifying(false);
      return;
    }
    // เรียก Backend เพื่อตรวจสอบ token
    authVerify()
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        clearToken(); // token หมดอายุหรือไม่ถูกต้อง — ล้างทิ้ง
        setIsAuthenticated(false);
      })
      .finally(() => setIsVerifying(false));
  }, []);

  const handleAuthenticate = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
  }, []);

  // แสดง loading ระหว่างตรวจ token (กัน flash หน้า login ก่อน verify เสร็จ)
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f1f5f9]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout isAuthenticated={isAuthenticated} onLogout={handleLogout} />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* หน้าที่ใครๆ ก็ดูได้ */}
        <Route path="/dashboard" element={<Overview />} />

        <Route path="/beds" element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onAuthenticate={handleAuthenticate}>
            <BedDashboard />
          </ProtectedRoute>
        } />

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
        <Route path="/graph" element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onAuthenticate={handleAuthenticate}>
            <Graph />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;