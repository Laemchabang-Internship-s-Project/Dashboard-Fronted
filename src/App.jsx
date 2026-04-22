import React, { useState, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { checkNetwork } from './services/api';
import { Toaster } from 'react-hot-toast';

import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import GasInspection from './pages/GasInspection';
import SummarOPD from './pages/SummaryOPD';

// ตัวเฝ้าประตู: เช็คว่าถ้าเข้าหน้าภายในแต่ไม่ใช่เน็ตโรงพยาบาล ให้เด้งไป Dashboard รวม
function ProtectedRoute({ isInternal, children }) {
  if (isInternal === null) return null; // รอโหลดสถานะ
  return isInternal ? children : <Navigate to="/dashboard" replace />;
}

function MainLayout() {
  // สร้าง State สำหรับเก็บตำแหน่งของ Toast โดยเช็คขนาดจอเริ่มต้น
  const [toastPosition, setToastPosition] = useState(
    window.innerWidth < 768 ? 'top-right' : 'bottom-right'
  );

  useEffect(() => {
    const handleResize = () => {
      // ถ้าจอเล็กกว่า 768px (ขนาด md ของ Tailwind) ให้ไปอยู่ขวาบน
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
    <div className="flex bg-[#f1f5f9] font-['Sarabun'] min-h-screen">
      <Toaster position={toastPosition} reverseOrder={false} />
      <Sidebar />
      <main className="flex-1 md:pl-16 transition-all duration-300 overflow-x-hidden overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const [isInternal, setIsInternal] = useState(null);

  useEffect(() => {
    checkNetwork().then(setIsInternal);
  }, []);

  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* หน้าแรก: ถ้าเป็นคนในไป /opd ถ้าคนนอกไป /dashboard */}
        <Route path="/" element={<Navigate to={isInternal ? "/opd" : "/dashboard"} replace />} />

        {/* หน้าที่ใครๆ ก็ดูได้ */}
        <Route path="/dashboard" element={<Overview />} />

        {/* หน้าที่ต้องเป็นคนในโรงพยาบาลเท่านั้น */}
        <Route path="/gas" element={
          <ProtectedRoute isInternal={isInternal}><GasInspection /></ProtectedRoute>
        } />
        <Route path="/opd" element={
          <ProtectedRoute isInternal={isInternal}><SummarOPD /></ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default App;