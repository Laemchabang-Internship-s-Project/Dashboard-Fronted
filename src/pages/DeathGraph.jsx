import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSkullCrossbones, faHospital, faHouse, faClock, faChartBar,
  faChartPie, faRotateRight, faLocationDot, faBiohazard, faNotesMedical
} from '@fortawesome/free-solid-svg-icons';
import ApexChart from 'react-apexcharts';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { LiveClock, CHART_COLORS, MONTH_NAMES } from '../components/ChartComponents';

// ─── Constants ────────────────────────────────────────────────────────────────
const MATERIAL_COLORS = ["#020617", "#ff8f00", "#00897b", "#1e88e5", "#d81b60", "#f44336", "#9c27b0", "#3f51b5"];

// ─── Metric Card (Strictly Dental Style) ──────────────────────────────────────────
const MetricCard = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" />
    </div>
    <div>
      <p className="text-xs text-gray-400 font-semibold truncate max-w-[150px]" title={label}>{label}</p>
      <p className="text-xl font-bold text-gray-800">{value ?? '—'}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeathGraph() {
  const [activeGraph, setActiveGraph] = useState('causes');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiGetInternal('/api/graph/death-summary');
      if (res && res.status === 'success') {
        setData(res.data);
      } else {
        throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      }
    } catch (err) {
      console.error(err);
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── Data Processing ────────────────────────────────────────────────────────
  const processedPlaces = [];
  if (data?.places) {
    data.places.forEach(p => {
      let name = p.place_name || 'ไม่ระบุ';
      if (name.includes('ไม่ระบุ') || name.includes('ไม่ทราบ') || !name.trim()) {
        name = 'ไม่ระบุ';
      }
      const existing = processedPlaces.find(x => x.place_name === name);
      if (existing) {
        existing.count += p.count;
      } else {
        processedPlaces.push({ ...p, place_name: name });
      }
    });
  }
  const sortedPlaces = [...processedPlaces].sort((a, b) => b.count - a.count);
  const totalDeaths = sortedPlaces.reduce((acc, p) => acc + p.count, 0) || 0;

  // ── ApexCharts Configs ───────────────────────────────────────────────────

  // 1. Causes (Horizontal Bar)
  const causesConfig = {
    series: [{ name: "จำนวนการเสียชีวิต", data: (data?.top_causes || []).map(c => c.total_cases) }],
    options: {
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true, barHeight: '70%', dataLabels: { position: 'right' } } },
      colors: MATERIAL_COLORS,
      dataLabels: { enabled: true, style: { colors: ['#333'], fontFamily: "'Sarabun', sans-serif" }, formatter: (val) => val.toLocaleString(), offsetX: 10 },
      xaxis: { categories: (data?.top_causes || []).map(c => c.cause), labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
      yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" }, maxWidth: 200 } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } },
      legend: { show: false }
    }
  };

  // 2. Places (Pie)
  const placesPieConfig = {
    series: sortedPlaces.map(p => p.count),
    options: {
      chart: { type: 'pie', toolbar: { show: false } },
      labels: sortedPlaces.map(p => p.place_name),
      colors: MATERIAL_COLORS,
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        fontFamily: "'Sarabun', sans-serif",
        fontSize: '12px',
        formatter: (val, opts) => {
          const label = sortedPlaces[opts.seriesIndex]?.place_name || val;
          return label.length > 25 ? label.substring(0, 25) + '...' : label;
        }
      },
      tooltip: {
        theme: "light",
        y: { formatter: (val) => `${val.toLocaleString()} ราย` },
        style: { fontFamily: "'Sarabun', sans-serif" }
      },
      plotOptions: { pie: { expandOnClick: true, donut: { size: '65%' } } }
    }
  };

  // 3. Monthly Trend (Line)
  const monthlyTrendConfig = {
    series: [{ name: "ผู้เสียชีวิต", data: (data?.monthly_trend || []).map(m => m.death_count) }],
    options: {
      chart: { type: 'line', toolbar: { show: true }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 3 },
      colors: ['#ef4444'],
      xaxis: {
        categories: (data?.monthly_trend || []).map(m => {
          const [y, mo] = m.month_year.split('-');
          return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.substring(2)}`;
        }),
        labels: { style: { fontFamily: "'Sarabun', sans-serif" } }
      },
      yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
      markers: { size: 4 },
      grid: { borderColor: '#f1f5f9' },
      tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } }
    }
  };

  // 4. Hours Distribution (Bar)
  const hoursConfig = {
    series: [{ name: "จำนวนเคส", data: (data?.hours || []).map(h => h.total_cases) }],
    options: {
      chart: { type: 'bar', toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '70%' } },
      colors: ['#f59e0b'],
      xaxis: {
        categories: (data?.hours || []).map(h => `${String(h.death_hour).padStart(2, '0')}:00`),
        labels: { style: { fontFamily: "'Sarabun', sans-serif", fontSize: '10px' } }
      },
      yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
      grid: { borderColor: '#f1f5f9' },
      tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } }
    }
  };

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Death Analysis - LCBH</title></Helmet>

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        <style>{`
          .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
          .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        `}</style>

        {loading && !data ? (
          <div className="space-y-6">
            <HeaderSkeleton /><ChartSkeleton height={600} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                  <FontAwesomeIcon icon={faSkullCrossbones} className="text-red-500" />
                  Death Analysis Dashboard
                </h1>
                <p className="text-gray-400 text-sm mt-1">สถิติและภาพรวมการเสียชีวิต</p>
              </div>
              <div className="flex items-center gap-3 mt-4 md:mt-0">
                <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl hover:bg-white shadow-sm">
                  <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <div className="flex flex-col items-end whitespace-nowrap"><LiveClock /></div>
                <span className="text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider bg-red-100 text-red-700">ONLINE</span>
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-6">{error}</div>}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="ยอดรวมผู้เสียชีวิต" value={totalDeaths.toLocaleString()} icon={faNotesMedical} color="bg-red-500" />
              {sortedPlaces.slice(0, 3).map((p, i) => (
                <MetricCard key={i} label={p.place_name} value={p.count.toLocaleString()} icon={faLocationDot} color={i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-rose-500' : 'bg-amber-500'} />
              ))}
            </div>

            {/* Chart Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 lg:p-8 flex flex-col animate-fade-up">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-50 pb-6">
                <h2 className="font-bold text-gray-700 text-lg flex items-center">
                  {activeGraph === 'causes' && <><FontAwesomeIcon icon={faBiohazard} className="text-red-500 mr-2" />สาเหตุการเสียชีวิต (Top Causes)</>}
                  {activeGraph === 'monthly' && <><FontAwesomeIcon icon={faChartBar} className="text-violet-500 mr-2" />แนวโน้มรายเดือน (Monthly Trend)</>}
                  {activeGraph === 'hours' && <><FontAwesomeIcon icon={faClock} className="text-amber-500 mr-2" />ช่วงเวลาที่เสียชีวิต (Hour Distribution)</>}
                  {activeGraph === 'places' && <><FontAwesomeIcon icon={faChartPie} className="text-blue-500 mr-2" />สถานที่เสียชีวิต (Place Breakdown)</>}
                </h2>

                <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                  {[
                    { key: 'causes', label: 'Causes', icon: faBiohazard },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar },
                    { key: 'hours', label: 'Hours', icon: faClock },
                    { key: 'places', label: 'Places', icon: faChartPie },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveGraph(tab.key)} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeGraph === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                      <FontAwesomeIcon icon={tab.icon} className="mr-2" />{tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full relative flex-1 min-h-[400px]">
                {activeGraph === 'places' && (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-full max-w-2xl">
                      <ApexChart options={placesPieConfig.options} series={placesPieConfig.series} type="pie" height={380} />
                    </div>
                  </div>
                )}
                {activeGraph === 'causes' && (
                  <ApexChart options={causesConfig.options} series={causesConfig.series} type="bar" height={500} />
                )}
                {activeGraph === 'monthly' && (
                  <ApexChart options={monthlyTrendConfig.options} series={monthlyTrendConfig.series} type="line" height={400} />
                )}
                {activeGraph === 'hours' && (
                  <ApexChart options={hoursConfig.options} series={hoursConfig.series} type="bar" height={400} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
