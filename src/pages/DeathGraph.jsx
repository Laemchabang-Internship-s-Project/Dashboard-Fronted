import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSkullCrossbones, faHospital, faHouse, faClock, faChartBar,
  faChartPie, faRotateRight, faLocationDot, faBiohazard, faNotesMedical
} from '@fortawesome/free-solid-svg-icons';
import ApexChart from 'react-apexcharts';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { LiveClock, MONTH_NAMES } from '../components/ChartComponents';
import {
  MetricCard,
  GlassCard,
  DashboardStyles,
  MATERIAL_COLORS
} from '../components/DashboardUI';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeathGraph() {
  const [activeGraph, setActiveGraph] = useState('causes');
  const [causesRows, setCausesRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [monthlyRange, setMonthlyRange] = useState('12');
  const [placesRows, setPlacesRows] = useState([]);
  const [hoursRows, setHoursRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchView = useCallback(async (view) => {
    try {
      const res = await apiGetInternal(`/api/graph/death-summary?view=${view}`);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [causesData, monthlyData, placesData, hoursData] = await Promise.all([
      fetchView('causes'),
      fetchView('monthly'),
      fetchView('places'),
      fetchView('hours')
    ]);

    if (causesData) setCausesRows(causesData);
    if (monthlyData) setMonthlyRows(monthlyData);
    if (placesData) setPlacesRows(placesData);
    if (hoursData) setHoursRows(hoursData);
    setLoading(false);
  }, [fetchView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── Data Processing ────────────────────────────────────────────────────────
  const sortedPlaces = useMemo(() => {
    if (!placesRows || placesRows.length === 0) return [];
    const processedPlaces = [];
    placesRows.forEach(p => {
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
    return processedPlaces.sort((a, b) => b.count - a.count);
  }, [placesRows]);

  const totalDeaths = useMemo(() => {
    return sortedPlaces.reduce((acc, p) => acc + p.count, 0) || 0;
  }, [sortedPlaces]);

  // ── ApexCharts Configs (useMemo for Stability) ───────────────────────────

  const causesConfig = useMemo(() => {
    if (!causesRows || causesRows.length === 0) return null;
    return {
      series: [{ name: "จำนวนการเสียชีวิต", data: causesRows.map(c => c.total_cases) }],
      options: {
        chart: { type: 'bar', toolbar: { show: true } },
        plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: true, barHeight: '70%', dataLabels: { position: 'top' } } },
        colors: MATERIAL_COLORS,
        dataLabels: {
          enabled: true,
          style: { colors: ['#333'], fontFamily: "'Sarabun', sans-serif" },
          formatter: (val) => val.toLocaleString(),
          textAnchor: 'start',
          offsetX: 15
        },
        xaxis: { categories: causesRows.map(c => c.cause), labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
        yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" }, maxWidth: 200 } },
        grid: { borderColor: '#f1f5f9' },
        tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } },
        legend: { show: false }
      }
    };
  }, [causesRows]);

  const placesPieConfig = useMemo(() => {
    if (!placesRows || placesRows.length === 0) return null;
    return {
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
  }, [placesRows, sortedPlaces]);

  const monthlyTrendConfig = useMemo(() => {
    if (!monthlyRows || monthlyRows.length === 0) return null;
    const sliceIndex = monthlyRange === 'all' ? 0 : -parseInt(monthlyRange, 10);
    const recentMonthly = sliceIndex === 0 ? monthlyRows : monthlyRows.slice(sliceIndex);
    return {
      series: [{ name: "ผู้เสียชีวิต", data: recentMonthly.map(m => m.death_count) }],
      options: {
        chart: { type: 'line', toolbar: { show: true }, zoom: { enabled: false } },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#ef4444'],
        xaxis: {
          categories: recentMonthly.map(m => {
            const [y, mo] = m.month_year.split('-');
            return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.substring(2)}`;
          }),
          labels: { style: { fontFamily: "'Sarabun', sans-serif" } }
        },
        yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
        markers: { size: 4 },
        grid: { borderColor: '#f1f5f9' },
        title: { text: 'จำนวนผู้เสียชีวิตรายเดือน', align: 'center', style: { fontFamily: "'Sarabun', sans-serif" } },
        tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } }
      }
    };
  }, [monthlyRows, monthlyRange]);

  const hoursConfig = useMemo(() => {
    if (!hoursRows || hoursRows.length === 0) return null;
    return {
      series: [{ name: "จำนวนเคส", data: hoursRows.map(h => h.total_cases) }],
      options: {
        chart: { type: 'line', toolbar: { show: false } },
        stroke: { curve: 'smooth', width: 4 },
        colors: ['#f59e0b'],
        xaxis: {
          categories: hoursRows.map(h => `${String(h.death_hour).padStart(2, '0')}:00`),
          labels: { style: { fontFamily: "'Sarabun', sans-serif", fontSize: '10px' } }
        },
        yaxis: { labels: { style: { fontFamily: "'Sarabun', sans-serif" } } },
        grid: { borderColor: '#f1f5f9' },
        markers: { size: 5, colors: ['#fff'], strokeColors: '#f59e0b', strokeWidth: 3 },
        tooltip: { theme: "light", style: { fontFamily: "'Sarabun', sans-serif" } }
      }
    };
  }, [hoursRows]);

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Death Analysis - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        {loading && (!causesRows || causesRows.length === 0) ? (
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
            <GlassCard className="animate-fade-up">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-50 pb-6">
                <div className="flex flex-wrap items-center gap-3">
                  {activeGraph === 'causes' && (
                    <h2 className="font-bold text-gray-700 text-lg flex items-center">
                      <FontAwesomeIcon icon={faBiohazard} className="text-red-500 mr-2" />สาเหตุการเสียชีวิต (Top Causes)
                    </h2>
                  )}
                  {activeGraph === 'monthly' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faChartBar} className="text-violet-500 mr-2" />แนวโน้มรายเดือน (Monthly)
                      </h2>
                      <select
                        value={monthlyRange}
                        onChange={e => setMonthlyRange(e.target.value)}
                        className="bg-violet-50 border border-violet-100 text-violet-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-violet-300 transition-all"
                      >
                        <option value="12">ย้อนหลัง 12 เดือน</option>
                        <option value="24">ย้อนหลัง 24 เดือน</option>
                        <option value="all">ทั้งหมด (All time)</option>
                      </select>
                    </>
                  )}
                  {activeGraph === 'hours' && (
                    <h2 className="font-bold text-gray-700 text-lg flex items-center">
                      <FontAwesomeIcon icon={faClock} className="text-amber-500 mr-2" />ช่วงเวลาที่เสียชีวิต (Hour Distribution)
                    </h2>
                  )}
                  {activeGraph === 'places' && (
                    <h2 className="font-bold text-gray-700 text-lg flex items-center">
                      <FontAwesomeIcon icon={faChartPie} className="text-blue-500 mr-2" />สถานที่เสียชีวิต (Place Breakdown)
                    </h2>
                  )}
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto">
                  {[
                    { key: 'causes', label: 'Causes', icon: faBiohazard, activeColor: 'text-red-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'hours', label: 'Hours', icon: faClock, activeColor: 'text-amber-600' },
                    { key: 'places', label: 'Places', icon: faChartPie, activeColor: 'text-blue-600' },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveGraph(tab.key)} className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeGraph === tab.key ? 'bg-white shadow-sm ' + tab.activeColor : 'text-gray-500 hover:text-gray-700'}`}>
                      <FontAwesomeIcon icon={tab.icon} className="mr-2" />{tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full relative flex-1 min-h-[400px]">
                {activeGraph === 'places' && placesPieConfig && (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-full max-w-2xl">
                      <ApexChart options={placesPieConfig.options} series={placesPieConfig.series} type="pie" height={380} />
                    </div>
                  </div>
                )}
                {activeGraph === 'causes' && causesConfig && (
                  <ApexChart options={causesConfig.options} series={causesConfig.series} type="bar" height={500} />
                )}
                {activeGraph === 'monthly' && monthlyTrendConfig && (
                  <ApexChart options={monthlyTrendConfig.options} series={monthlyTrendConfig.series} type="line" height={400} />
                )}
                {activeGraph === 'hours' && hoursConfig && (
                  <ApexChart options={hoursConfig.options} series={hoursConfig.series} type="line" height={400} />
                )}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
