import { Routes, Route, Outlet } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import SummaryDashboard from './pages/SummaryDashboard';
import GasInspection from './pages/GasInspection';

function MainLayout() {
  return (
    <div className="flex bg-[#f1f5f9] font-['Sarabun'] min-h-screen">
      <Sidebar />

      <main className="flex-1 pl-16 transition-all duration-300 overflow-x-hidden overflow-y-auto pb-1">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Navigate to="/opd" replace />} />
        <Route path="/opd" element={<SummaryDashboard />} />
        <Route path="/gas" element={<GasInspection />} />
      </Route>
      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
}

export default App;