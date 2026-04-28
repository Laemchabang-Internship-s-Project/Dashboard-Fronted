import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from "react-helmet-async";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRotateRight, faChartLine, faChartBar, faCalendarDays,
  faChevronDown, faTooth, faUserDoctor, faMoneyBillWave, faFileMedical, faNotesMedical
} from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { ChartCanvas, LiveClock, CHART_COLORS, MONTH_NAMES, MONTH_KEYS, formatMonthLabel } from '../components/ChartComponents';

// ─── Metric Card ──────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" />
    </div>
    <div>
      <p className="text-xs text-gray-400 font-semibold">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value ?? '—'}</p>
    </div>
  </div>
);

// ─── helper ───────────────────────────────────────────────────────────────────
function extractOptions(dailyRows = []) {
  const months = [...new Set(dailyRows.map(d => d.date.substring(0, 7)))].sort((a, b) => b.localeCompare(a));
  const years  = [...new Set(dailyRows.map(d => d.date.substring(0, 4)))].sort((a, b) => b.localeCompare(a));
  return { months, years };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DentalGraph() {
  // ── State แยก view ──────────────────────────────────────────────────────
  const [activeGraph,   setActiveGraph]   = useState('daily');
  const [activeMetric,  setActiveMetric]  = useState('patient_count');

  // daily
  const [dailyRows,        setDailyRows]        = useState([]);
  const [availableMonths,  setAvailableMonths]   = useState([]);
  const [availableYears,   setAvailableYears]    = useState([]);
  const [selectedMonth,    setSelectedMonth]     = useState('');

  // monthly
  const [monthlyRows,      setMonthlyRows]       = useState([]);
  const [monthlyRange,     setMonthlyRange]      = useState('12');

  // yoy
  const [yoyMap,           setYoyMap]            = useState({});

  // meta (KPI cards)
  const [meta,             setMeta]              = useState(null);

  // ui
  const [loading,          setLoading]           = useState(true);
  const [error,            setError]             = useState('');
  const [isRefreshing,     setIsRefreshing]      = useState(false);

  // ── Fetch helper ──────────────────────────────────────────────────────────
  const fetchView = useCallback(async (view, opts = {}) => {
    try {
      const params = new URLSearchParams({ view, ...opts });
      const res = await apiGetInternal(`/api/graph/dental-summary?${params}`);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, []);

  // ── Initial load: daily + yoy + meta พร้อมกัน ────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');

      const [daily, yoy, metaData] = await Promise.all([
        fetchView('daily'),
        fetchView('yoy'),
        fetchView('meta'),
      ]);

      if (daily) {
        const sorted = daily.sort((a, b) => a.date.localeCompare(b.date));
        setDailyRows(sorted);
        const { months, years } = extractOptions(sorted);
        setAvailableMonths(months);
        setAvailableYears(years);
        if (months.length) setSelectedMonth(months[0]); // เดือนล่าสุด (เนื่องจาก sort DESC แล้ว)
      }
      if (yoy)      setYoyMap(yoy);
      if (metaData) setMeta(metaData);

      setLoading(false);
    })();
  }, [fetchView]);

  // ── Lazy load monthly เมื่อ user เปลี่ยนไป Monthly tab ──────────────────
  useEffect(() => {
    if (activeGraph !== 'monthly' || monthlyRows.length > 0) return;
    (async () => {
      const data = await fetchView('monthly');
      if (data) setMonthlyRows(data);
    })();
  }, [activeGraph, monthlyRows.length, fetchView]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError('');

    const promises = [fetchView('daily'), fetchView('yoy'), fetchView('meta')];
    if (activeGraph === 'monthly') promises.push(fetchView('monthly'));
    const [daily, yoy, metaData, monthly] = await Promise.all(promises);

    if (daily) {
      const sorted = daily.sort((a, b) => a.date.localeCompare(b.date));
      setDailyRows(sorted);
      const { months, years } = extractOptions(sorted);
      setAvailableMonths(months);
      setAvailableYears(years);
    }
    if (yoy)      setYoyMap(yoy);
    if (metaData) setMeta(metaData);
    if (monthly)  setMonthlyRows(monthly);

    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── Metric metadata ────────────────────────────────────────────────────────
  const metrics = {
    patient_count: { label: 'ผู้ป่วย (คน)',  color: '#3b82f6', legendColor: '#3b82f6' },
    case_count:    { label: 'จำนวนเคส',       color: '#10b981', legendColor: '#10b981' },
    total_revenue: { label: 'รายได้ (บาท)',   color: '#f59e0b', legendColor: '#f59e0b' },
    doctor_count:  { label: 'แพทย์ (คน)',    color: '#8b5cf6', legendColor: '#8b5cf6' },
  };

  // ── Chart data: Daily ──────────────────────────────────────────────────────
  const filteredDaily = selectedMonth
    ? dailyRows.filter(d => d.date.startsWith(selectedMonth))
    : dailyRows.slice(-31);

  const dailyData = {
    labels: filteredDaily.map(d => { const p = d.date.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: Object.entries(metrics).map(([key, meta_m], i) => ({
      type: 'bar',
      label: meta_m.label,
      data: filteredDaily.map(d => d[key]),
      backgroundColor: filteredDaily.map((_, j) => CHART_COLORS[(i * 4 + j) % CHART_COLORS.length]),
      legendColor: meta_m.legendColor,
      borderRadius: { topLeft: 4, topRight: 4 },
      hidden: key !== activeMetric,
    })),
  };

  // ── Chart data: Monthly ────────────────────────────────────────────────────
  const sortedMonthly = [...monthlyRows].sort((a, b) => {
    if (a.year !== b.year) return a.year.localeCompare(b.year);
    return a.month.localeCompare(b.month);
  });
  
  const sliceIndex = monthlyRange === 'all' ? 0 : -parseInt(monthlyRange, 10);
  const filteredMonthly = sliceIndex === 0 ? sortedMonthly : sortedMonthly.slice(sliceIndex);

  const monthlyData = {
    labels: filteredMonthly.map(r => `${MONTH_NAMES[parseInt(r.month, 10) - 1]} ${r.year.substring(2)}`),
    datasets: Object.entries(metrics).map(([key, meta_m], i) => ({
      label: meta_m.label,
      data: filteredMonthly.map(r => r[key] || 0),
      backgroundColor: filteredMonthly.map((_, j) => CHART_COLORS[(i * 4 + j) % CHART_COLORS.length]),
      legendColor: meta_m.legendColor,
      borderRadius: 8,
      barPercentage: 0.5,
      borderSkipped: false,
      hidden: key !== activeMetric,
    })),
  };

  // ── Chart data: YoY ────────────────────────────────────────────────────────
  const years = Object.keys(yoyMap).sort();
  const yoyDatasets = years.map((yr, idx) => {
    const isLatest = idx === years.length - 1;
    const monthsWithData = Object.keys(yoyMap[yr]);
    const maxMonth = monthsWithData.length > 0 ? Math.max(...monthsWithData.map(Number)) : 0;
    return {
      type: 'line',
      label: `ปี ${yr}`,
      data: MONTH_KEYS.map(m => {
        if (parseInt(m, 10) > maxMonth) return null;
        return yoyMap[yr][m]?.[activeMetric] ?? 0;
      }),
      borderColor: CHART_COLORS[idx % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
      borderWidth: isLatest ? 4 : 2,
      pointRadius: isLatest ? 4 : 2,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    };
  });
  const yoyData = { labels: MONTH_NAMES, datasets: yoyDatasets };

  const metricTabs = [
    { key: 'patient_count', label: 'ผู้ป่วย', color: 'bg-blue-500' },
    { key: 'case_count',    label: 'เคส',      color: 'bg-emerald-500' },
    { key: 'total_revenue', label: 'รายได้',   color: 'bg-amber-500' },
    { key: 'doctor_count',  label: 'แพทย์',    color: 'bg-violet-500' },
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

        {loading && !dailyRows.length ? (
          <div className="space-y-6">
            <HeaderSkeleton />
            <ChartSkeleton height={600} />
          </div>
        ) : (
          <>
            {/* ── Glass Header ─────────────────────────────────────────── */}
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

            {/* ── Summary KPI Cards (จาก meta key เดียว) ───────────────── */}
            {meta && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="ผู้ป่วย (ล่าสุด)" value={meta.patient_count.toLocaleString()} icon={faNotesMedical} color="bg-blue-500" />
                <MetricCard label="เคส (ล่าสุด)"     value={meta.case_count.toLocaleString()}    icon={faFileMedical}  color="bg-emerald-500" />
                <MetricCard label="รายได้ (ล่าสุด)"  value={`฿${meta.total_revenue.toLocaleString()}`} icon={faMoneyBillWave} color="bg-amber-500" />
                <MetricCard label="แพทย์ (ล่าสุด)"   value={meta.doctor_count.toLocaleString()}  icon={faUserDoctor}   color="bg-violet-500" />
              </div>
            )}

            {/* ── Main Chart Card ───────────────────────────────────────── */}
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
                          value={selectedMonth}
                          onChange={e => setSelectedMonth(e.target.value)}
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
                          value={monthlyRange}
                          onChange={e => setMonthlyRange(e.target.value)}
                          className="appearance-none bg-violet-50/50 border-2 border-violet-100 text-violet-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-violet-300 transition-all"
                        >
                          <option value="12">ย้อนหลัง 12 เดือน</option>
                          <option value="24">ย้อนหลัง 24 เดือน</option>
                          <option value="36">ย้อนหลัง 36 เดือน</option>
                          <option value="all">ทั้งหมด (All time)</option>
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
                    { key: 'daily',   label: 'Daily',   icon: faChartLine,    activeColor: 'text-blue-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar,     activeColor: 'text-violet-600' },
                    { key: 'yoy',     label: 'YoY',     icon: faCalendarDays, activeColor: 'text-amber-600' },
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

              {/* Metric selector */}
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
                  <ChartCanvas id="dentalDailyChart" type="bar" data={dailyData} hideLegend={true}
                    options={{ maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 31 } } } }} />
                )}
                {activeGraph === 'monthly' && (
                  monthlyRows.length === 0
                    ? <div className="flex items-center justify-center h-full text-gray-400">กำลังโหลด...</div>
                    : <ChartCanvas id="dentalMonthlyChart" type="bar" data={monthlyData} hideLegend={true}
                        options={{ maintainAspectRatio: false }} />
                )}
                {activeGraph === 'yoy' && (
                  <ChartCanvas id="dentalYoyChart" type="line" data={yoyData} hideLegend={false}
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
