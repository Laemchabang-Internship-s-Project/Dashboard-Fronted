import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import SummaryDashboard from './pages/SummaryDashboard';
import GasInspection from './pages/GasInspection';

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="flex bg-[#f1f5f9] font-['Sarabun'] min-h-screen">
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
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