import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

  // stats (operations, doctors, departments)
  const [operationsRows, setOperationsRows] = useState([]);
  const [doctorsRows, setDoctorsRows] = useState([]);
  const [departmentsRows, setDepartmentsRows] = useState([]);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear().toString());
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorDrilldownRows, setDoctorDrilldownRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyDrilldownRows, setDailyDrilldownRows] = useState([]);

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

  const fetchDailyDrilldown = useCallback(async (dateStr) => {
    try {
      const params = new URLSearchParams({ date_str: dateStr });
      const res = await apiGetInternal(`/api/graph/doctor-operations/daily-drilldown?${params}`);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
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

  // ── Lazy load monthly & stats เมื่อ user เปลี่ยน tab หรือเปลี่ยนปี ──────────────────
  useEffect(() => {
    if (activeGraph === 'monthly' && monthlyRows.length === 0) {
      fetchView('monthly').then(data => { if (data) setMonthlyRows(data) });
    }
    if (activeGraph === 'operations') {
      fetchView('operations', { year: statsYear }).then(data => { if (data) setOperationsRows(data); });
    }
    if (activeGraph === 'doctors') {
      fetchView('doctors', { year: statsYear }).then(data => { if (data) setDoctorsRows(data); });
    }
    if (activeGraph === 'departments') {
      fetchView('departments', { year: statsYear }).then(data => { if (data) setDepartmentsRows(data); });
    }
  }, [activeGraph, monthlyRows.length, statsYear, fetchView]);

  // ── Reset drilldown state เมื่อเปลี่ยน tab ────────────────────────────────
  useEffect(() => {
    if (activeGraph !== 'daily') {
      setSelectedDate(null);
      setDailyDrilldownRows([]);
    }
    if (activeGraph !== 'doctors') {
      setSelectedDoctor(null);
      setDoctorDrilldownRows([]);
    }
  }, [activeGraph]);

  // ── Drilldown Fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeGraph === 'doctors' && selectedDoctor) {
      fetchView('drilldown', { year: statsYear, doctor_name: selectedDoctor }).then(data => {
        if (data) setDoctorDrilldownRows(data);
      });
    }
  }, [activeGraph, selectedDoctor, statsYear, fetchView]);

  useEffect(() => {
    if (activeGraph === 'daily' && selectedDate) {
      fetchDailyDrilldown(selectedDate).then(data => {
        if (data) setDailyDrilldownRows(data);
      });
    }
  }, [activeGraph, selectedDate, fetchDailyDrilldown]);

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
    if (activeGraph === 'operations') { const d = await fetchView('operations', { year: statsYear }); if (d) setOperationsRows(d); }
    if (activeGraph === 'doctors') { const d = await fetchView('doctors', { year: statsYear }); if (d) setDoctorsRows(d); }
    if (activeGraph === 'departments') { const d = await fetchView('departments', { year: statsYear }); if (d) setDepartmentsRows(d); }

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

  // ── Chart data: Stats ──────────────────────────────────────────────────────
  const createStatData = (rows, label) => ({
    labels: rows.map(r => r.name || 'ไม่ระบุ'),
    datasets: [{
      type: 'bar',
      label: label,
      data: rows.map(r => r.total_count),
      backgroundColor: rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      hoverBackgroundColor: rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderRadius: 4,
      maxBarThickness: 50,
    }],
  });
  const operationsData = createStatData(operationsRows, 'จำนวนครั้ง');
  const doctorsData = createStatData(doctorsRows, 'จำนวนเคส');
  const departmentsData = createStatData(departmentsRows, 'จำนวนครั้ง');

  const drilldownData = useMemo(() => ({
    labels: doctorDrilldownRows.map(r => r.name || 'ไม่ระบุ'),
    datasets: [{
      label: 'จำนวนครั้ง',
      data: doctorDrilldownRows.map(r => r.total_count),
      backgroundColor: doctorDrilldownRows.map((_, i) => i === 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(96, 165, 250, 0.5)'),
      borderColor: doctorDrilldownRows.map((_, i) => i === 0 ? 'rgb(37, 99, 235)' : 'rgb(59, 130, 246)'),
      borderWidth: 1,
      borderRadius: 4,
    }]
  }), [doctorDrilldownRows]);

  const dailyDrilldownData = useMemo(() => {
    const top10 = dailyDrilldownRows.slice(0, 10);
    return {
      labels: top10.map(r => r.name || 'ไม่ระบุ'),
      datasets: [{
        label: 'จำนวนครั้ง',
        data: top10.map(r => r.total_count),
        backgroundColor: top10.map((_, i) => i === 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(52, 211, 153, 0.5)'),
        borderColor: top10.map((_, i) => i === 0 ? 'rgb(5, 150, 105)' : 'rgb(16, 185, 129)'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    };
  }, [dailyDrilldownRows]);


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

                  {['operations', 'doctors', 'departments'].includes(activeGraph) && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg md:text-xl flex items-center">
                        <FontAwesomeIcon icon={faChartBar} className="text-teal-500 mr-2" />
                        {activeGraph === 'operations' ? 'Top 10 หัตถการ' : activeGraph === 'doctors' ? 'Top 10 แพทย์' : 'Top 10 แผนก'}
                      </h2>
                      <div className="relative group min-w-[140px]">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <FontAwesomeIcon icon={faCalendarDays} className="text-teal-500/70" />
                        </div>
                        <select
                          value={statsYear}
                          onChange={(e) => setStatsYear(e.target.value)}
                          className="appearance-none bg-teal-50/50 border-2 border-teal-100 text-teal-700 text-sm font-bold rounded-xl block w-full pl-9 pr-10 py-2 cursor-pointer outline-none hover:border-teal-300 transition-all"
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>ปี {y}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <FontAwesomeIcon icon={faChevronDown} className="text-teal-500/70 text-xs" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <GraphTabs
                  activeTab={activeGraph}
                  onTabChange={setActiveGraph}
                  tabs={[
                    { key: 'daily', label: 'Daily', icon: faChartLine, activeColor: 'text-blue-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'yoy', label: 'YoY', icon: faCalendarDays, activeColor: 'text-amber-600' },
                    { key: 'operations', label: 'Top หัตถการ', icon: faChartBar, activeColor: 'text-teal-600' },
                    { key: 'doctors', label: 'Top แพทย์', icon: faChartBar, activeColor: 'text-teal-600' },
                    { key: 'departments', label: 'Top แผนก', icon: faChartBar, activeColor: 'text-teal-600' },
                  ]}
                />
              </div>

              {/* Graph Content Area */}
              <div className="w-full relative flex flex-col">

                {activeGraph === 'monthly' && (
                  <div className="h-[400px] md:h-[500px] w-full">
                    {monthlyRows.length === 0
                      ? <div className="flex items-center justify-center h-full text-gray-400">กำลังโหลด...</div>
                      : <ChartCanvas id="monthlyChart" type="bar" data={monthlyData} hideLegend={true} options={{ maintainAspectRatio: false }} />}
                  </div>
                )}
                {activeGraph === 'yoy' && (
                  <div className="h-[400px] md:h-[500px] w-full">
                    <ChartCanvas id="yoyChart" type="line" data={yoyData} hideLegend={false} options={{ maintainAspectRatio: false }} />
                  </div>
                )}
                {activeGraph === 'daily' && (
                  <div className="flex flex-col gap-4">
                    <div className="h-[350px] md:h-[450px] w-full">
                      {dailyRows.length === 0
                        ? <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล หรือกำลังประมวลผล กรุณารอสักครู่แล้วกด Refresh 🔄</div>
                        : <ChartCanvas
                          id="dailyChart"
                          type="bar"
                          data={dailyData}
                          hideLegend={true}
                          options={{
                            maintainAspectRatio: false,
                            scales: { x: { ticks: { maxTicksLimit: 31 } } },
                            onHover: (event, chartElement) => {
                              event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                            },
                            onClick: (event, elements) => {
                              if (elements.length > 0) {
                                const index = elements[0].index;
                                const dateStr = filteredDaily[index].op_date;
                                setSelectedDate(dateStr);
                              }
                            }
                          }}
                        />
                      }
                    </div>
                    {selectedDate && (
                      <div className="border-t-2 border-gray-100 pt-4 relative">
                        <button
                          onClick={() => setSelectedDate(null)}
                          className="absolute top-4 right-2 text-gray-400 hover:text-red-500 text-sm z-10 font-bold bg-white/80 px-2 py-1 rounded"
                        >
                          ✕ ปิด
                        </button>
                        <h3 className="text-md font-bold text-gray-700 mb-3">
                          <FontAwesomeIcon icon={faChartBar} className="text-emerald-500 mr-2" />
                          รายละเอียดหัตถการ วันที่: <span className="text-emerald-600">{selectedDate}</span>
                          <span className="ml-3 text-sm font-normal text-gray-400">({dailyDrilldownRows.length} รายการ)</span>
                        </h3>
                        {dailyDrilldownRows.length === 0
                          ? <div className="flex items-center justify-center h-[200px] text-gray-400">ไม่พบข้อมูลหัตถการในวันนี้...</div>
                          : <div className="overflow-y-auto max-h-[350px] rounded-xl border border-gray-100">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-emerald-50 text-emerald-700">
                                <tr>
                                  <th className="text-left px-3 py-2 font-bold">#</th>
                                  <th className="text-left px-3 py-2 font-bold">ชื่อหัตถการ</th>
                                  <th className="text-right px-3 py-2 font-bold">จำนวน</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dailyDrilldownRows.map((row, i) => (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-1.5 text-gray-400 text-xs">{i + 1}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{row.name}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-emerald-600">{row.total_count.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        }
                      </div>
                    )}
                  </div>
                )}
                {activeGraph === 'operations' && (
                  <div className="h-[400px] md:h-[500px] w-full">
                    {operationsRows.length === 0
                      ? <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล หรือกำลังประมวลผล กรุณารอสักครู่แล้วกด Refresh 🔄</div>
                      : <ChartCanvas id="operationsChart" type="bar" data={operationsData} hideLegend={true} options={{ maintainAspectRatio: false, indexAxis: 'y' }} />}
                  </div>
                )}
                {activeGraph === 'doctors' && (
                  <div className="flex flex-col gap-4">
                    <div className="h-[350px] md:h-[450px] w-full">
                      {doctorsRows.length === 0
                        ? <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล หรือกำลังประมวลผล กรุณารอสักครู่แล้วกด Refresh 🔄</div>
                        : <ChartCanvas
                            id="doctorsChart"
                            type="bar"
                            data={doctorsData}
                            hideLegend={true}
                            options={{
                              maintainAspectRatio: false,
                              indexAxis: 'y',
                              onHover: (event, chartElement) => {
                                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                              },
                              onClick: (event, elements, chart) => {
                                if (elements.length > 0) {
                                  const index = elements[0].index;
                                  const doctorName = chart.data.labels[index];
                                  setSelectedDoctor(doctorName);
                                }
                              }
                            }}
                          />
                      }
                    </div>
                    {selectedDoctor && (
                      <div className="border-t-2 border-gray-100 pt-4 relative">
                        <button
                          onClick={() => setSelectedDoctor(null)}
                          className="absolute top-4 right-2 text-gray-400 hover:text-red-500 text-sm z-10 font-bold bg-white/80 px-2 py-1 rounded whitespace-nowrap"
                        >
                          ✕ ปิด
                        </button>
                        <h3 className="text-md font-bold text-gray-700 mb-3">
                          <FontAwesomeIcon icon={faChartBar} className="text-blue-500 mr-2" />
                          หัตถการของ: <span className="text-blue-600">{selectedDoctor}</span>
                          <span className="ml-3 text-sm font-normal text-gray-400">({doctorDrilldownRows.length} รายการ)</span>
                        </h3>
                        {doctorDrilldownRows.length === 0
                          ? <div className="flex items-center justify-center h-[200px] text-gray-400">ไม่พบข้อมูล...</div>
                          : <div className="overflow-y-auto max-h-[350px] rounded-xl border border-gray-100">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-blue-50 text-blue-700">
                                <tr>
                                  <th className="text-left px-3 py-2 font-bold">#</th>
                                  <th className="text-left px-3 py-2 font-bold">ชื่อหัตถการ</th>
                                  <th className="text-right px-3 py-2 font-bold">จำนวน</th>
                                </tr>
                              </thead>
                              <tbody>
                                {doctorDrilldownRows.map((row, i) => (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-1.5 text-gray-400 text-xs">{i + 1}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{row.name}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-blue-600">{row.total_count.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        }
                      </div>
                    )}
                  </div>
                )}
                {activeGraph === 'departments' && (
                  <div className="h-[400px] md:h-[500px] w-full">
                    {departmentsRows.length === 0
                      ? <div className="flex items-center justify-center h-full text-gray-400">ไม่พบข้อมูล หรือกำลังประมวลผล กรุณารอสักครู่แล้วกด Refresh 🔄</div>
                      : <ChartCanvas id="departmentsChart" type="bar" data={departmentsData} hideLegend={true} options={{ maintainAspectRatio: false, indexAxis: 'y' }} />}
                  </div>
                )}
              </div>
            </GlassCard>

          </>
        )}
      </div>
    </div>
  );
}
