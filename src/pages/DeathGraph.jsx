import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ApexChart from 'react-apexcharts';
import {
  faSkullCrossbones, faHospital, faHouse, faClock, faChartBar,
  faChartPie, faRotateRight, faLocationDot, faBiohazard, faNotesMedical
} from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { ChartCanvas, LiveClock, MONTH_NAMES } from '../components/ChartComponents';
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

// ─── helper: Mapping ชื่อสาเหตุเพื่อให้แสดงผลหลายบรรทัด ───────────────────────
const CAUSE_NAME_MAP = {
  'สาเหตุจากภายนอกอื่นๆ ที่ทำให้ป่วยหรือตาย': ['สาเหตุจากภายนอกอื่นๆ', 'ที่ทำให้ป่วยหรือตาย'],
  'อุบัติเหตุจากการขนส่ง และผลที่ตามมา': ['อุบัติเหตุจากการขนส่ง', 'และผลที่ตามมา'],
  'อาการ, อาการแสดงและสิ่งผิดปกติที่พบได้จากการตรวจทางคลีนิก และทางห้องปฏิบัติการ': ['อาการแสดงและสิ่งผิดปกติ', 'ที่พบได้จากการตรวจทางคลีนิก'],
  'โรคระบบย่อยอาหาร รวมโรคในช่องปาก': ['โรคระบบย่อยอาหาร', 'รวมโรคในช่องปาก']
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DeathGraph() {
  const [activeGraph, setActiveGraph] = useState('causes');
  const [causesRows, setCausesRows] = useState([]);
  const currentYYYY = new Date().getFullYear().toString();
  const currentMM = String(new Date().getMonth() + 1).padStart(2, '0');
  const [causesYear, setCausesYear] = useState(currentYYYY);
  const [causesMonth, setCausesMonth] = useState(currentMM);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [monthlyRange, setMonthlyRange] = useState('12');
  const [placesRows, setPlacesRows] = useState([]);
  const [hoursRows, setHoursRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });



  const fetchView = useCallback(async (view) => {
    try {
      let url = `/api/graph/death-summary?view=${view}`;
      // causes และ places ใช้ filter เดียวกัน
      if (view === 'causes' || view === 'places') {
        if (causesYear !== 'all') {
          if (causesMonth !== 'all') {
            url += `&month=${causesYear}-${causesMonth}`;
          } else {
            url += `&year=${causesYear}`;
          }
        }
      }
      const res = await apiGetInternal(url);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, [causesYear, causesMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [causesData, monthlyData, placesData, hoursData] = await Promise.all([
      fetchView('causes'),
      fetchView('monthly'),
      fetchView('places'),
      fetchView('hours')
    ]);

    if (causesData !== null) setCausesRows(causesData || []);
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

  // KPI: ใช้ปี/เดือนปัจจุบัน (ตามปฏิทิน)
  const latestYearKpi = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear().toString();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curMonthYear = `${curYear}-${curMonth}`;

    // รวมยอดทั้งปีปัจจุบัน
    const yearTotal = (monthlyRows || [])
      .filter(r => (r.month_year || '').startsWith(curYear))
      .reduce((sum, r) => sum + (r.death_count || 0), 0);

    // ยอดเดือนปัจจุบัน (อาจเป็น 0 ถ้ายังไม่มีข้อมูล)
    const curMonthRow = (monthlyRows || []).find(r => r.month_year === curMonthYear);
    const latestMonthCount = curMonthRow ? (curMonthRow.death_count || 0) : 0;

    return { year: curYear, total: yearTotal, latestMonth: curMonthYear, latestMonthCount };
  }, [monthlyRows]);

  // ── ApexCharts Configs (useMemo for Stability) ───────────────────────────

  const causesData = useMemo(() => {
    const rows = causesRows && causesRows.length > 0 ? causesRows : [{ cause: 'ไม่พบข้อมูล', total_cases: 0 }];
    const isEmpty = causesRows && causesRows.length === 0;
    return {
      _isEmpty: isEmpty,
      labels: rows.map(c => CAUSE_NAME_MAP[c.cause] || c.cause),
      datasets: [{
        label: "จำนวนการเสียชีวิต",
        data: rows.map(c => c.total_cases),
        backgroundColor: isEmpty ? ['#e2e8f0'] : rows.map((_, i) => MATERIAL_COLORS[i % MATERIAL_COLORS.length]),
        borderRadius: 4,
        maxBarThickness: isEmpty ? 80 : 50,
        minBarLength: isEmpty ? 0 : 40,
      }]
    };
  }, [causesRows]);
  //pie death graph

  const placesPieConfig = useMemo(() => {
    if (!placesRows || placesRows.length === 0) return null;
    return {
      series: sortedPlaces.map(p => p.count),
      options: {
        chart: { type: 'pie', toolbar: { show: true } },
        labels: sortedPlaces.map(p => p.place_name),
        colors: MATERIAL_COLORS,
        dataLabels: {
          enabled: true,
          style: { colors: ['#1e293b'], fontFamily: "'Sarabun', sans-serif", fontSize: '12px' },
          dropShadow: { enabled: false }
        },
        //legend ตรง pie charts
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

  const monthlyData = useMemo(() => {
    if (!monthlyRows || monthlyRows.length === 0) return null;
    const sliceIndex = monthlyRange === 'all' ? 0 : -parseInt(monthlyRange, 10);
    const recentMonthly = sliceIndex === 0 ? monthlyRows : monthlyRows.slice(sliceIndex);
    return {
      labels: recentMonthly.map(m => {
        const [y, mo] = m.month_year.split('-');
        return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.substring(2)}`;
      }),
      datasets: [{
        label: "ผู้เสียชีวิต",
        data: recentMonthly.map(m => m.death_count),
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false,
      }]
    };
  }, [monthlyRows, monthlyRange]);

  const hoursData = useMemo(() => {
    if (!hoursRows || hoursRows.length === 0) return null;
    return {
      labels: hoursRows.map(h => `${String(h.death_hour).padStart(2, '0')}:00`),
      datasets: [{
        label: "จำนวนเคส",
        data: hoursRows.map(h => h.total_cases),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        borderWidth: 4,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#f59e0b',
        pointBorderWidth: 3,
        fill: false,
      }]
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
            <DashboardHeader
              title="Death Analysis Dashboard"
              subtitle="สถิติและภาพรวมการเสียชีวิต"
            />
            <ErrorMessage error={error} />

            {/* KPI Cards — ปีล่าสุด + เดือนล่าสุด */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label={`ยอดรวมผู้เสียชีวิต ปี ${latestYearKpi.year}`}
                value={(latestYearKpi.total || 0).toLocaleString()}
                icon={faNotesMedical}
                color="bg-red-500"
              />
              <MetricCard
                label={`เดือนล่าสุด (${latestYearKpi.latestMonth})`}
                value={(latestYearKpi.latestMonthCount || 0).toLocaleString()}
                icon={faLocationDot}
                color="bg-blue-500"
              />
              {sortedPlaces.slice(0, 2).map((p, i) => (
                <MetricCard key={i} label={p.place_name} value={p.count.toLocaleString()} icon={faLocationDot} color={i === 0 ? 'bg-rose-500' : 'bg-amber-500'} />
              ))}
            </div>

            {/* Chart Container */}
            <GlassCard className="animate-fade-up">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-50 pb-6">
                <div className="flex flex-wrap items-center gap-3">
                  {activeGraph === 'causes' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faBiohazard} className="text-red-500 mr-2" />สาเหตุการเสียชีวิต (Top Causes)
                      </h2>
                      <div className="flex gap-2">
                        <select
                          value={causesYear}
                          onChange={e => {
                            setCausesYear(e.target.value);
                            if (e.target.value === 'all') setCausesMonth('all');
                          }}
                          className="bg-red-50 border border-red-100 text-red-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-red-300 transition-all"
                        >
                          <option value="all">ทั้งหมด (All time)</option>
                          <option value="2026">2026</option>
                          <option value="2025">2025</option>
                          <option value="2024">2024</option>
                          <option value="2023">2023</option>
                          <option value="2022">2022</option>
                        </select>
                        <select
                          value={causesMonth}
                          onChange={e => setCausesMonth(e.target.value)}
                          disabled={causesYear === 'all'}
                          className="bg-red-50 border border-red-100 text-red-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="all">ทั้งปี</option>
                          {MONTH_NAMES.map((name, i) => (
                            <option key={i} value={String(i + 1).padStart(2, '0')}>{name}</option>
                          ))}
                        </select>
                      </div>
                    </>
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

                <GraphTabs
                  activeTab={activeGraph}
                  onTabChange={setActiveGraph}
                  tabs={[
                    { key: 'causes', label: 'Causes', icon: faBiohazard, activeColor: 'text-red-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'hours', label: 'Hours', icon: faClock, activeColor: 'text-amber-600' },
                    { key: 'places', label: 'Places', icon: faChartPie, activeColor: 'text-blue-600' },
                  ]}
                />
              </div>

              <div className="w-full relative flex-1 min-h-[400px]">
                {activeGraph === 'causes' && (
                  <div className="h-[500px] w-full relative">
                    {causesData._isEmpty && (
                      <div className="absolute top-2 left-0 right-0 flex justify-center z-10">
                        <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">ไม่พบข้อมูลในช่วงเวลานี้</span>
                      </div>
                    )}
                    <ChartCanvas
                      id="causesChart"
                      type="bar"
                      data={causesData}
                      hideLegend={true}
                      options={{
                        indexAxis: 'y',
                        maintainAspectRatio: false,
                        layout: { padding: { left: 10, right: 30 } }
                      }}
                    />
                  </div>
                )}
                {activeGraph === 'places' && (
                  <div className="flex justify-center items-center h-[450px] relative">
                    {(!placesRows || placesRows.length === 0) ? (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <div className="text-5xl mb-3">📊</div>
                        <p className="font-semibold text-base text-gray-500">ไม่พบข้อมูล</p>
                      </div>
                    ) : (
                      <div className="w-full max-w-2xl">
                        <ApexChart options={placesPieConfig.options} series={placesPieConfig.series} type="pie" height={380} />
                      </div>
                    )}
                  </div>
                )}
                {activeGraph === 'monthly' && (
                  <div className="h-[450px] relative">
                    {(!monthlyRows || monthlyRows.length === 0) && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 rounded-xl">
                        <div className="text-5xl mb-3">📊</div>
                        <p className="text-gray-500 font-semibold text-base">ไม่พบข้อมูล</p>
                      </div>
                    )}
                    {monthlyData && <ChartCanvas id="monthlyDeathChart" type="line" data={monthlyData} hideLegend={true} options={{ maintainAspectRatio: false }} />}
                  </div>
                )}
                {activeGraph === 'hours' && (
                  <div className="h-[450px] relative">
                    {(!hoursRows || hoursRows.length === 0) && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 rounded-xl">
                        <div className="text-5xl mb-3">📊</div>
                        <p className="text-gray-500 font-semibold text-base">ไม่พบข้อมูล</p>
                      </div>
                    )}
                    {hoursData && <ChartCanvas id="hoursChart" type="line" data={hoursData} hideLegend={true} options={{ maintainAspectRatio: false }} />}
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
