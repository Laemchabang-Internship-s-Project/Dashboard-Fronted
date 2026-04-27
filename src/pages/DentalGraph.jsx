import React, { useEffect, useState, useRef } from 'react';
import Chart from 'chart.js/auto';
import { Helmet } from "react-helmet-async";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRotateRight, faChartLine, faChartBar, faCalendarDays,
  faChevronDown, faTooth, faUserDoctor, faMoneyBillWave, faFileMedical, faNotesMedical
} from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';

// ─── Reusable ChartCanvas with Interactive HTML Legend ─────────────────────────
const ChartCanvas = ({ id, type, data, options }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [hiddenDatasets, setHiddenDatasets] = useState({});

  useEffect(() => { setHiddenDatasets({}); }, [data]);

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();

    if (chartRef.current && data) {
      chartInstance.current = new Chart(chartRef.current, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            ...options?.plugins,
            legend: { display: false },
            tooltip: {
              titleFont: { family: "'Sarabun', sans-serif", size: 14 },
              bodyFont: { family: "'Sarabun', sans-serif", size: 13 },
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              padding: 14,
              cornerRadius: 10,
              filter: (item) => item.raw !== null && item.raw !== undefined,
              ...options?.plugins?.tooltip
            }
          },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'Sarabun', sans-serif", size: 11 }, maxRotation: 45, minRotation: 0 },
              ...options?.scales?.x
            },
            y: {
              border: { dash: [4, 4] },
              grid: { color: '#f1f5f9' },
              beginAtZero: true,
              ticks: { font: { family: "'Sarabun', sans-serif", size: 11 }, maxTicksLimit: 12 },
              ...options?.scales?.y
            }
          },
          ...options
        }
      });

      // Re-apply hidden states
      Object.keys(hiddenDatasets).forEach(idx => {
        if (hiddenDatasets[idx]) chartInstance.current.setDatasetVisibility(Number(idx), false);
      });
      chartInstance.current.update();
    }

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, options, type]);

  const toggleDataset = (idx) => {
    const isHidden = !hiddenDatasets[idx];
    setHiddenDatasets(prev => ({ ...prev, [idx]: isHidden }));
    if (chartInstance.current) {
      chartInstance.current.setDatasetVisibility(idx, !isHidden);
      chartInstance.current.update();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">


      {/* Canvas */}
      <div className="flex-1 relative w-full h-full min-h-[300px]">
        <canvas id={id} ref={chartRef} />
      </div>
    </div>
  );
};

// ─── Live Clock ─────────────────────────────────────────────────────────────────
const LiveClock = () => {
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const opts = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const tick = () => setCurrentTime(new Date().toLocaleString('th-TH', opts));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-xs font-semibold text-gray-500">{currentTime}</span>;
};

// ─── Metric Card ────────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, icon, color }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4`}>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" />
    </div>
    <div>
      <p className="text-xs text-gray-400 font-semibold">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value ?? '—'}</p>
    </div>
  </div>
);

// ─── Distinct colour palette (15) ───────────────────────────────────────────────
const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#14b8a6', '#eab308', '#d946ef', '#0ea5e9', '#f43f5e',
];

const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function DentalGraph() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View toggles
  const [activeGraph, setActiveGraph] = useState('daily');
  const [activeMetric, setActiveMetric] = useState('patient_count');
  const [selectedDailyMonth, setSelectedDailyMonth] = useState('');
  const [selectedMonthlyYear, setSelectedMonthlyYear] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const res = await apiGetInternal('/api/graph/dental-summary');
      const sorted = (res.data || []).sort((a, b) => a.date.localeCompare(b.date));
      setRawData(sorted);

      // Init default month & year filters
      if (sorted.length > 0) {
        const latest = sorted[sorted.length - 1].date.substring(0, 7);
        setSelectedDailyMonth(prev => prev || latest);
        setSelectedMonthlyYear(prev => prev || sorted[sorted.length - 1].date.substring(0, 4));
      }
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── Summary stats (latest date row) ────────────────────────────────────────
  const latestRow = rawData.length > 0 ? rawData[rawData.length - 1] : null;

  // ── Available months / years for filters ──────────────────────────────────
  const availableMonths = [...new Set(rawData.map(d => d.date.substring(0, 7)))].sort();
  const availableYears = [...new Set(rawData.map(d => d.date.substring(0, 4)))].sort();

  const formatMonthLabel = (yyyymm) => {
    if (!yyyymm) return '';
    const [y, m] = yyyymm.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  };

  // ── Metric metadata ────────────────────────────────────────────────────────
  const metrics = {
    patient_count: { label: 'ผู้ป่วย (คน)', color: '#3b82f6', legendColor: '#3b82f6' },
    case_count: { label: 'จำนวนเคส', color: '#10b981', legendColor: '#10b981' },
    total_revenue: { label: 'รายได้ (บาท)', color: '#f59e0b', legendColor: '#f59e0b' },
    doctor_count: { label: 'แพทย์ (คน)', color: '#8b5cf6', legendColor: '#8b5cf6' },
  };

  // ── 1. Daily chart data ────────────────────────────────────────────────────
  const filteredDaily = selectedDailyMonth
    ? rawData.filter(d => d.date.startsWith(selectedDailyMonth))
    : [];

  const dailyData = {
    labels: filteredDaily.map(d => { const p = d.date.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: Object.entries(metrics).map(([key, meta], i) => ({
      type: 'bar',
      label: meta.label,
      data: filteredDaily.map(d => d[key]),
      backgroundColor: filteredDaily.map((_, j) => COLORS[(i * 4 + j) % COLORS.length]),
      legendColor: meta.legendColor,
      borderRadius: { topLeft: 4, topRight: 4 },
      hidden: key !== activeMetric,
    }))
  };

  // ── 2. Monthly chart data (bar) ────────────────────────────────────────────
  const monthlyAgg = {};
  rawData.filter(d => d.date.startsWith(selectedMonthlyYear)).forEach(d => {
    const m = d.date.substring(5, 7);
    if (!monthlyAgg[m]) monthlyAgg[m] = { patient_count: 0, case_count: 0, total_revenue: 0, doctor_count: 0 };
    monthlyAgg[m].patient_count += d.patient_count;
    monthlyAgg[m].case_count += d.case_count;
    monthlyAgg[m].total_revenue += d.total_revenue;
    monthlyAgg[m].doctor_count += d.doctor_count;
  });

  const monthlyData = {
    labels: MONTH_NAMES,
    datasets: Object.entries(metrics).map(([key, meta]) => ({
      label: meta.label,
      data: MONTH_KEYS.map(m => monthlyAgg[m]?.[key] || 0),
      backgroundColor: COLORS.slice(0, 12),
      legendColor: meta.legendColor,
      borderRadius: 8,
      barPercentage: 0.5,
      borderSkipped: false,
      hidden: key !== activeMetric,
    }))
  };

  // ── 3. YoY chart data (line overlay) ─────────────────────────────────────
  const yoyAgg = {};
  rawData.forEach(d => {
    const yr = d.date.substring(0, 4);
    const m = d.date.substring(5, 7);
    if (!yoyAgg[yr]) yoyAgg[yr] = {};
    if (!yoyAgg[yr][m]) yoyAgg[yr][m] = { patient_count: 0, case_count: 0, total_revenue: 0, doctor_count: 0 };
    yoyAgg[yr][m].patient_count += d.patient_count;
    yoyAgg[yr][m].case_count += d.case_count;
    yoyAgg[yr][m].total_revenue += d.total_revenue;
    yoyAgg[yr][m].doctor_count += d.doctor_count;
  });

  const years = Object.keys(yoyAgg).sort();
  const yoyDatasets = years.map((yr, idx) => {
    const isLatest = idx === years.length - 1;
    const monthsWithData = Object.keys(yoyAgg[yr]);
    const maxMonth = monthsWithData.length > 0 ? Math.max(...monthsWithData.map(Number)) : 0;

    return {
      type: 'line',
      label: `ปี ${yr}`,
      data: MONTH_KEYS.map(m => {
        if (parseInt(m, 10) > maxMonth) return null;
        return yoyAgg[yr][m]?.[activeMetric] ?? 0;
      }),
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: COLORS[idx % COLORS.length],
      borderWidth: isLatest ? 4 : 2,
      pointRadius: isLatest ? 4 : 2,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    };
  });

  const yoyData = { labels: MONTH_NAMES, datasets: yoyDatasets };

  // ── Metric selector tabs ───────────────────────────────────────────────────
  const metricTabs = [
    { key: 'patient_count', label: 'ผู้ป่วย', color: 'bg-blue-500' },
    { key: 'case_count', label: 'เคส', color: 'bg-emerald-500' },
    { key: 'total_revenue', label: 'รายได้', color: 'bg-amber-500' },
    { key: 'doctor_count', label: 'แพทย์', color: 'bg-violet-500' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="p-3 md:p-6 min-h-screen"
      style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}
    >
      <Helmet>
        <title>Dental Analytics - LCBH</title>
        <meta name="description" content="กราฟสถิติแผนกทันตกรรม" />
      </Helmet>

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        <style>{`
          .glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
          .soft-shadow { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
        `}</style>

        {loading && !rawData.length ? (
          <div className="space-y-6">
            <HeaderSkeleton />
            <ChartSkeleton height={600} />
          </div>
        ) : (
          <>
            {/* ── Glass Header ───────────────────────────────────── */}
            <div className="flex flex-wrap justify-between items-center glass p-5 rounded-2xl soft-shadow border border-white/40 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                  <FontAwesomeIcon icon={faTooth} className="text-teal-500" />
                  Dental Analytics Dashboard
                </h1>
                <p className="text-gray-400 text-sm mt-1">สถิติและภาพรวมแผนกทันตกรรม</p>
              </div>
              <div className="flex items-center gap-3 mt-4 md:mt-0">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`p-2 bg-white/50 border border-gray-200 text-gray-500 rounded-xl transition hover:bg-white shadow-sm ${isRefreshing ? 'opacity-50' : ''}`}
                >
                  <FontAwesomeIcon icon={faRotateRight} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <div className="flex flex-col items-end whitespace-nowrap">
                  <LiveClock />
                </div>
                <span className="text-[10px] px-3 py-1 rounded-full uppercase font-bold tracking-wider bg-teal-100 text-teal-700">ONLINE</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 shadow-sm">{error}</div>
            )}

            {/* ── Summary KPI Cards ───────────────────────────────── */}
            {latestRow && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="ผู้ป่วย (ล่าสุด)" value={latestRow.patient_count.toLocaleString()} icon={faNotesMedical} color="bg-blue-500" />
                <MetricCard label="เคส (ล่าสุด)" value={latestRow.case_count.toLocaleString()} icon={faFileMedical} color="bg-emerald-500" />
                <MetricCard label="รายได้ (ล่าสุด)" value={`฿${latestRow.total_revenue.toLocaleString()}`} icon={faMoneyBillWave} color="bg-amber-500" />
                <MetricCard label="แพทย์ (ล่าสุด)" value={latestRow.doctor_count.toLocaleString()} icon={faUserDoctor} color="bg-violet-500" />
              </div>
            )}

            {/* ── Main Chart Card ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 lg:p-8 flex flex-col">

              {/* Top Section: Title & Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-4 border-b border-gray-50 pb-6">

                {/* Left: title + filter */}
                <div className="flex flex-wrap items-center gap-3">
                  {activeGraph === 'daily' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faChartLine} className="text-blue-500 mr-2" />Daily Trend
                      </h2>
                      <div className="relative group min-w-[180px]">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <FontAwesomeIcon icon={faCalendarDays} className="text-blue-400/80" />
                        </div>
                        <select
                          value={selectedDailyMonth}
                          onChange={e => setSelectedDailyMonth(e.target.value)}
                          className="appearance-none bg-blue-50/50 border-2 border-blue-100 text-blue-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-blue-300 transition-all"
                        >
                          {availableMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <FontAwesomeIcon icon={faChevronDown} className="text-blue-400/80 text-xs" />
                        </div>
                      </div>
                    </>
                  )}
                  {activeGraph === 'monthly' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faChartBar} className="text-violet-500 mr-2" />Monthly Summary
                      </h2>
                      <div className="relative group min-w-[140px]">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <FontAwesomeIcon icon={faCalendarDays} className="text-violet-400/80" />
                        </div>
                        <select
                          value={selectedMonthlyYear}
                          onChange={e => setSelectedMonthlyYear(e.target.value)}
                          className="appearance-none bg-violet-50/50 border-2 border-violet-100 text-violet-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-violet-300 transition-all"
                        >
                          {availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <FontAwesomeIcon icon={faChevronDown} className="text-violet-400/80 text-xs" />
                        </div>
                      </div>
                    </>
                  )}
                  {activeGraph === 'yoy' && (
                    <h2 className="font-bold text-gray-700 text-lg flex items-center">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-amber-500 mr-2" />YoY Comparison
                    </h2>
                  )}
                </div>

                {/* Right: Graph type switcher */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto self-start">
                  {[
                    { key: 'daily', label: 'Daily', icon: faChartLine, activeColor: 'text-blue-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'yoy', label: 'YoY', icon: faCalendarDays, activeColor: 'text-amber-600' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveGraph(tab.key)}
                      className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2
                        ${activeGraph === tab.key ? `bg-white ${tab.activeColor} shadow-sm` : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <FontAwesomeIcon icon={tab.icon} /> {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric selector (ผู้ป่วย / เคส / รายได้ / แพทย์) */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-xs text-gray-400 font-semibold self-center mr-1">แสดง:</span>
                {metricTabs.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setActiveMetric(m.key)}
                    className={`shrink-0 px-4 py-1.5 rounded-full border text-xs font-bold transition-all duration-200
                      ${activeMetric === m.key
                        ? `${m.color} text-white border-transparent shadow-md`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Graph Content Area */}
              <div className="w-full relative flex-1 h-[350px] sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[700px]">
                {activeGraph === 'daily' && (
                  <ChartCanvas id="dentalDailyChart" type="bar" data={dailyData}
                    options={{ maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 31 } } } }} />
                )}
                {activeGraph === 'monthly' && (
                  <ChartCanvas id="dentalMonthlyChart" type="bar" data={monthlyData}
                    options={{ maintainAspectRatio: false }} />
                )}
                {activeGraph === 'yoy' && (
                  <ChartCanvas id="dentalYoyChart" type="line" data={yoyData}
                    options={{ maintainAspectRatio: false }} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

