import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from "react-helmet-async";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight, faChartLine, faChartBar, faCalendarDays, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { ChartCanvas, LiveClock, CHART_COLORS, MONTH_NAMES, MONTH_KEYS, formatMonthLabel } from '../components/ChartComponents';
import {
  DashboardStyles,
  MetricCard,
  GlassCard,
  SectionHeader,
  MATERIAL_COLORS,
  DashboardHeader,
  ErrorMessage,
  GraphTabs
} from '../components/DashboardUI';

// ─── helper: ดึง list ปีและเดือนที่มีในข้อมูล daily ──────────────────────────
function extractOptions(dailyRows = []) {
  const months = [...new Set(dailyRows.map(d => d.op_date.substring(0, 7)))].sort((a, b) => b.localeCompare(a));
  const years = [...new Set(dailyRows.map(d => d.op_date.substring(0, 4)))].sort((a, b) => b.localeCompare(a));
  return { months, years };
}

export default function Graph() {
  // ── State แยกต่างหากตาม view ──────────────────────────────────────────────
  const [activeGraph, setActiveGraph] = useState('daily');

  // daily
  const [dailyRows, setDailyRows] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');

  // monthly
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [monthlyRange, setMonthlyRange] = useState('12');

  // yoy
  const [yoyMap, setYoyMap] = useState({});

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });

  // ── Fetch: ดึงเฉพาะ view ที่ใช้งาน ────────────────────────────────────────
  const fetchView = useCallback(async (view, opts = {}) => {
    try {
      const params = new URLSearchParams({ view, ...opts });
      const res = await apiGetInternal(`/api/graph/doctor-operations?${params}`);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, []);

  // ── Initial load: daily + yoy พร้อมกัน, monthly lazy ─────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');

      const [daily, yoy] = await Promise.all([
        fetchView('daily'),
        fetchView('yoy'),
      ]);

      if (daily) {
        const sorted = daily.sort((a, b) => a.op_date.localeCompare(b.op_date));
        setDailyRows(sorted);
        const { months, years } = extractOptions(sorted);
        setAvailableMonths(months);
        setAvailableYears(years);
        if (months.length) setSelectedMonth(months[0]);
      }
      if (yoy) setYoyMap(yoy);

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

    const promises = [fetchView('daily'), fetchView('yoy')];
    if (activeGraph === 'monthly') promises.push(fetchView('monthly'));
    const [daily, yoy, monthly] = await Promise.all(promises);

    if (daily) {
      const sorted = daily.sort((a, b) => a.op_date.localeCompare(b.op_date));
      setDailyRows(sorted);
      const { months, years } = extractOptions(sorted);
      setAvailableMonths(months);
      setAvailableYears(years);
    }
    if (yoy) setYoyMap(yoy);
    if (monthly) setMonthlyRows(monthly);

    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── Chart data: Daily ──────────────────────────────────────────────────────
  const filteredDaily = selectedMonth
    ? dailyRows.filter(d => d.op_date.startsWith(selectedMonth))
    : dailyRows.slice(-31);

  const dailyData = {
    labels: filteredDaily.map(d => { const p = d.op_date.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: [{
      type: 'bar',
      label: 'จำนวนผ่าตัดรายวัน',
      data: filteredDaily.map(d => d.total_operations),
      backgroundColor: filteredDaily.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      hoverBackgroundColor: filteredDaily.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      legendColor: '#f63b3b',
      borderRadius: { topLeft: 4, topRight: 4 },
      maxBarThickness: 50,
    }],
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
    datasets: [{
      label: `จำนวนผ่าตัด`,
      data: filteredMonthly.map(r => r.total),
      backgroundColor: filteredMonthly.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      hoverBackgroundColor: filteredMonthly.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      legendColor: '#8b5cf6',
      borderRadius: 8,
      barPercentage: 0.5,
      maxBarThickness: 50,
      borderSkipped: false,
    }],
  };

  // ── Chart data: YoY ────────────────────────────────────────────────────────
  const years = Object.keys(yoyMap).sort();
  const yoyDatasets = years.map((year, index) => {
    const isLatestYear = index === years.length - 1;
    const monthsWithData = Object.keys(yoyMap[year]);
    const maxMonth = monthsWithData.length > 0 ? Math.max(...monthsWithData.map(Number)) : 0;
    return {
      type: 'line',
      label: `ปี ${year}`,
      data: MONTH_KEYS.map(m => {
        if (parseInt(m, 10) > maxMonth) return null;
        return yoyMap[year][m] || 0;
      }),
      borderColor: CHART_COLORS[index % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
      borderWidth: isLatestYear ? 4 : 2,
      pointRadius: isLatestYear ? 4 : 2,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    };
  });
  const yoyData = { labels: MONTH_NAMES, datasets: yoyDatasets };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)" }}>
      <Helmet>
        <title>Doctor Operations Analysis - LCBH</title>
        <meta name="description" content="กราฟแสดงสถิติการผ่าตัดของแพทย์" />
      </Helmet>

      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">

        {loading && !dailyRows.length ? (
          <div className="space-y-6">
            <HeaderSkeleton />
            <ChartSkeleton height={600} />
          </div>
        ) : (
          <>
            <DashboardHeader
              title="Doctor Operations Dashboard"
              subtitle="สถิติและภาพรวมการผ่าตัดของแพทย์"
            />

            <ErrorMessage error={error} />

            {/* Main Unified Dashboard Card */}
            <GlassCard className="p-4 md:p-6 lg:p-8 flex flex-col animate-fade-up">

              {/* Top Section: Title & Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-4 border-b border-gray-50 pb-6">

                {/* 1. Dynamic Title & Selector Area */}
                <div className="flex flex-wrap items-center gap-3">
                  {activeGraph === 'daily' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg md:text-xl flex items-center">
                        <FontAwesomeIcon icon={faChartLine} className="text-blue-500 mr-2" />
                        Daily Trend
                      </h2>
                      <div className="relative group min-w-[180px]">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <FontAwesomeIcon icon={faCalendarDays} className="text-blue-500/70" />
                        </div>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="appearance-none bg-blue-50/50 border-2 border-blue-100 text-blue-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-blue-300 transition-all"
                        >
                          {availableMonths.map(month => (
                            <option key={month} value={month}>{formatMonthLabel(month)}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <FontAwesomeIcon icon={faChevronDown} className="text-blue-500/70 text-xs" />
                        </div>
                      </div>
                    </>
                  )}

                  {activeGraph === 'monthly' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg md:text-xl flex items-center">
                        <FontAwesomeIcon icon={faChartBar} className="text-violet-500 mr-2" />
                        Monthly Summary
                      </h2>
                      <div className="relative group min-w-[140px]">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <FontAwesomeIcon icon={faCalendarDays} className="text-violet-500/70" />
                        </div>
                        <select
                          value={monthlyRange}
                          onChange={(e) => setMonthlyRange(e.target.value)}
                          className="appearance-none bg-violet-50/50 border-2 border-violet-100 text-violet-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-violet-300 transition-all"
                        >
                          <option value="12">ย้อนหลัง 12 เดือน</option>
                          <option value="24">ย้อนหลัง 24 เดือน</option>
                          <option value="36">ย้อนหลัง 36 เดือน</option>
                          <option value="all">ทั้งหมด (All time)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <FontAwesomeIcon icon={faChevronDown} className="text-violet-500/70 text-xs" />
                        </div>
                      </div>
                    </>
                  )}

                  {activeGraph === 'yoy' && (
                    <h2 className="font-bold text-gray-700 text-lg md:text-xl flex items-center">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-amber-500 mr-2" />
                      YoY Comparison
                    </h2>
                  )}
                </div>

                <GraphTabs
                  activeTab={activeGraph}
                  onTabChange={setActiveGraph}
                  tabs={[
                    { key: 'daily', label: 'Daily', icon: faChartLine, activeColor: 'text-blue-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'yoy', label: 'YoY', icon: faCalendarDays, activeColor: 'text-amber-600' },
                  ]}
                />
              </div>

              {/* Graph Content Area */}
              <div className="w-full relative flex-1 h-[350px] sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[700px]">
                {activeGraph === 'daily' && (
                  <ChartCanvas id="dailyChart" type="bar" data={dailyData} hideLegend={true} options={{
                    maintainAspectRatio: false,
                    scales: { x: { ticks: { maxTicksLimit: 31 } } }
                  }} />
                )}
                {activeGraph === 'monthly' && (
                  monthlyRows.length === 0
                    ? <div className="flex items-center justify-center h-full text-gray-400">กำลังโหลด...</div>
                    : <ChartCanvas id="monthlyChart" type="bar" data={monthlyData} hideLegend={true} options={{ maintainAspectRatio: false }} />
                )}
                {activeGraph === 'yoy' && (
                  <ChartCanvas id="yoyChart" type="line" data={yoyData} hideLegend={false} options={{ maintainAspectRatio: false }} />
                )}
              </div>
            </GlassCard>

          </>
        )}
      </div>
    </div>
  );
}
