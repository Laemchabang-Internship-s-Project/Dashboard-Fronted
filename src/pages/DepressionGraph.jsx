import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from "react-helmet-async";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ApexChart from 'react-apexcharts';
import {
  faRotateRight, faChartLine, faChartBar, faCalendarDays,
  faBrain, faUserPlus, faExclamationTriangle, faChartPie, faTimes, faSpinner,
  faMapMarkerAlt, faUser, faCheckCircle, faHeartPulse
} from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { ChartCanvas, LiveClock, MONTH_NAMES, MONTH_KEYS, CHART_COLORS, formatMonthLabel } from '../components/ChartComponents';
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

// ─── helper ───────────────────────────────────────────────────────────────────
function extractOptions(dailyRows = []) {
  const months = [...new Set(dailyRows.map(d => d.date.substring(0, 7)))].sort((a, b) => b.localeCompare(a));
  const years = [...new Set(dailyRows.map(d => d.date.substring(0, 4)))].sort((a, b) => b.localeCompare(a));
  return { months, years };
}

// ─── Modal Drill-down ──────────────────────────────────────────────────────────
const UnassessedModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGetInternal('/api/graph/depression-unassessed');
      if (res && res.status === 'success') {
        setData(res.data);
      } else {
        throw new Error('ไม่สามารถดึงข้อมูลได้');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
              รายชื่อผู้ป่วยที่ยังไม่ได้ประเมิน
            </h3>
            <p className="text-sm text-gray-500 mt-1">รวมทั้งสิ้น {data.length.toLocaleString()} ราย</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-0 overflow-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl mb-3 text-blue-500" />
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500 bg-red-50 m-6 rounded-xl border border-red-100">{error}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">HN</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">ชื่อ-สกุล</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">เพศ/อายุ</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">สัญชาติ</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">วันที่ลงทะเบียน</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">สถานะ/ที่อยู่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="py-3 px-6 text-sm text-gray-600 font-mono">{row.hn}</td>
                    <td className="py-3 px-6 text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full ${row.sex === 'ชาย' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'} flex items-center justify-center shrink-0`}>
                          <FontAwesomeIcon icon={faUser} className="text-xs" />
                        </div>
                        {row.patient_name}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600">{row.sex} / {row.age} ปี</td>
                    <td className="py-3 px-6 text-sm text-gray-600">{row.citizenship}</td>
                    <td className="py-3 px-6 text-sm text-gray-600">{row.register_date}</td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      <div className="font-semibold text-amber-600 mb-1">{row.status}</div>
                      <div className="flex items-start gap-1 text-xs text-gray-500">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-red-400 mt-0.5 shrink-0" />
                        <span>{row.address}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan="6" className="py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DepressionGraph() {
  const [activeGraph, setActiveGraph] = useState('status');
  const [statusYear, setStatusYear] = useState('all');

  const [dailyRows, setDailyRows] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');

  const [monthlyRows, setMonthlyRows] = useState([]);
  const [monthlyRange, setMonthlyRange] = useState('12');

  const [statusRows, setStatusRows] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [yoyMap, setYoyMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState({ text: "Connecting...", color: "bg-gray-200 text-gray-800" });


  const fetchView = useCallback(async (view, opts = {}) => {
    try {
      const params = new URLSearchParams({ view, ...opts });
      if (view === 'status' && statusYear !== 'all') {
        params.append('year', statusYear);
      }
      const res = await apiGetInternal(`/api/graph/depression-summary?${params}`);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, [statusYear]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      const [daily, monthly, status, kpiData, yoyData] = await Promise.all([
        fetchView('daily'),
        fetchView('monthly'),
        fetchView('status'),
        fetchView('kpi'),
        fetchView('yoy')
      ]);

      if (daily) {
        setDailyRows(daily);
        const { months } = extractOptions(daily);
        setAvailableMonths(months);
        if (months.length) setSelectedMonth(months[0]);
      }
      if (monthly) setMonthlyRows(monthly);
      if (status) setStatusRows(status);
      if (kpiData) setKpi(kpiData);
      if (yoyData) setYoyMap(yoyData);

      setLoading(false);
    })();
  }, [fetchView]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError('');
    const [daily, monthly, status, kpiData, yoyData] = await Promise.all([
      fetchView('daily'),
      fetchView('monthly'),
      fetchView('status'),
      fetchView('kpi'),
      fetchView('yoy')
    ]);

    if (daily) {
      setDailyRows(daily);
      const { months } = extractOptions(daily);
      setAvailableMonths(months);
    }
    if (monthly) setMonthlyRows(monthly);
    if (status) setStatusRows(status);
    if (kpiData) setKpi(kpiData);
    if (yoyData) setYoyMap(yoyData);

    setTimeout(() => setIsRefreshing(false), 500);
  };

  const { total_cases, total_unassessed, today_new } = kpi || {};
  const assessed_count = (total_cases || 0) - (total_unassessed || 0);
  const coverage_rate = total_cases > 0 ? ((assessed_count / total_cases) * 100).toFixed(1) : 0;

  const highRiskCount = useMemo(() => {
    if (!statusRows) return 0;
    return statusRows
      .filter(s => s.status_name.match(/รุนแรง|ปานกลาง|กำลังรักษา|เฝ้าระวัง|เสี่ยง/))
      .reduce((sum, s) => sum + s.patient_count, 0);
  }, [statusRows]);

  const evaluationRows = useMemo(() => {
    return statusRows.filter(s => !s.status_name.includes('ยังไม่ได้ประเมิน'));
  }, [statusRows]);

  const coveragePieConfig = useMemo(() => {
    const unassessedItem = statusRows.find(s => s.status_name.includes('ยังไม่ได้ประเมิน'));
    const unassessedCount = unassessedItem ? unassessedItem.patient_count : 0;
    const assessedCount = evaluationRows.reduce((sum, s) => sum + s.patient_count, 0);
    const totalCount = assessedCount + unassessedCount;

    return {
      series: [assessedCount, unassessedCount],
      options: {
        chart: { type: 'donut' },
        labels: ['ประเมินแล้ว', 'ยังไม่ได้ประเมิน'],
        colors: ['#10b981', '#f43f5e'],
        plotOptions: {
          pie: {
            donut: {
              size: '70%',
              labels: {
                show: true,
                name: { show: true, fontFamily: "'Sarabun', sans-serif", fontSize: '14px', color: '#64748b' },
                value: { show: true, fontFamily: "'Sarabun', sans-serif", fontSize: '24px', fontWeight: 'bold', formatter: (val) => Number(val).toLocaleString() },
                total: { show: true, showAlways: true, label: 'ลงทะเบียนทั้งหมด', fontFamily: "'Sarabun', sans-serif", fontSize: '12px', formatter: () => totalCount.toLocaleString() }
              }
            }
          }
        },
        dataLabels: {
          enabled: true,
          style: { colors: ['#1e293b'], fontFamily: "'Sarabun', sans-serif", fontSize: '12px' },
          dropShadow: { enabled: false }
        },
        stroke: { width: 0 },
        legend: { position: 'bottom', fontFamily: "'Sarabun', sans-serif" },
        tooltip: { theme: 'light', style: { fontFamily: "'Sarabun', sans-serif" } }
      }
    };
  }, [statusRows, evaluationRows]);

  const statusData = useMemo(() => {
    if (!evaluationRows || evaluationRows.length === 0) return null;
    return {
      labels: evaluationRows.map(s => s.status_name),
      datasets: [{
        label: "จำนวนผู้ป่วย",
        data: evaluationRows.map(s => s.patient_count),
        backgroundColor: evaluationRows.map((_, i) => MATERIAL_COLORS[i % MATERIAL_COLORS.length]),
        borderRadius: 4,
        maxBarThickness: 50,
      }]
    };
  }, [evaluationRows]);

  const dailyData = useMemo(() => {
    if (!dailyRows || dailyRows.length === 0) return null;
    const filteredDaily = selectedMonth
      ? dailyRows.filter(d => d.date.startsWith(selectedMonth))
      : dailyRows.slice(-30);

    return {
      labels: filteredDaily.map(d => { const p = d.date.split('-'); return `${p[2]}/${p[1]}`; }),
      datasets: [{
        label: "เคสใหม่",
        data: filteredDaily.map(d => d.total_new_cases),
        backgroundColor: '#3b82f6',
        borderRadius: { topLeft: 4, topRight: 4 },
        maxBarThickness: 50,
      }]
    };
  }, [dailyRows, selectedMonth]);

  const monthlyData = useMemo(() => {
    if (!monthlyRows || monthlyRows.length === 0) return null;
    const sliceIndex = monthlyRange === 'all' ? 0 : -parseInt(monthlyRange, 10);
    const recentMonthly = sliceIndex === 0 ? monthlyRows : monthlyRows.slice(sliceIndex);
    return {
      labels: recentMonthly.map(r => `${MONTH_NAMES[parseInt(r.month, 10) - 1]} ${r.year.substring(2)}`),
      datasets: [{
        label: "เคสใหม่",
        data: recentMonthly.map(r => r.total),
        backgroundColor: '#8b5cf6',
        borderRadius: 8,
        maxBarThickness: 50,
      }]
    };
  }, [monthlyRows, monthlyRange]);

  const yoyData = useMemo(() => {
    if (!yoyMap || Object.keys(yoyMap).length === 0) return null;
    const years = Object.keys(yoyMap).sort();

    const datasets = years.map((yr, idx) => {
      const isLatest = idx === years.length - 1;
      const monthsWithData = Object.keys(yoyMap[yr]);
      const maxMonth = monthsWithData.length > 0 ? Math.max(...monthsWithData.map(Number)) : 0;

      return {
        type: 'line',
        label: `ปี ${yr}`,
        data: MONTH_KEYS.map(m => {
          if (parseInt(m, 10) > maxMonth) return null;
          return yoyMap[yr][m] || 0;
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

    return {
      labels: MONTH_NAMES,
      datasets
    };
  }, [yoyMap]);

  return (
    <div className="p-3 md:p-6 min-h-screen" style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}>
      <Helmet><title>Depression Registry - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        {loading && (!dailyRows || dailyRows.length === 0) ? (
          <div className="space-y-6">
            <HeaderSkeleton /><ChartSkeleton height={600} />
          </div>
        ) : (
          <>
            <DashboardHeader
              title="Depression Registry Dashboard"
              subtitle="สถิติและภาพรวมผู้ป่วยจิตเวช (ซึมเศร้า)"
            />

            <ErrorMessage error={error} />

            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="จำนวนผู้ลงทะเบียนทั้งหมด"
                value={(total_cases || 0).toLocaleString()}
                icon={faUserPlus}
                color="bg-blue-500"
              />
              <MetricCard
                label="อัตราความครอบคลุมการคัดกรอง"
                value={`${coverage_rate}%`}
                icon={faCheckCircle}
                color="bg-emerald-500"
              />
              <MetricCard
                label="จำนวนที่รอดำเนินการ (ยังไม่ประเมิน)"
                value={(total_unassessed || 0).toLocaleString()}
                icon={faExclamationTriangle}
                color="bg-red-500"
                isClickable={true}
                onClick={() => setIsModalOpen(true)}
              />
              <MetricCard
                label="กลุ่มเสี่ยงสูง / เฝ้าระวัง"
                value={highRiskCount.toLocaleString()}
                icon={faHeartPulse}
                color="bg-orange-500"
              />
            </div>

            {/* Main Chart Card */}
            <GlassCard className="animate-fade-up">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-50 pb-6">
                <div className="flex flex-wrap items-center gap-3">
                  {activeGraph === 'status' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faChartPie} className="text-amber-500 mr-2" />สัดส่วนสถานะการประเมิน (Status)
                      </h2>
                      <select
                        value={statusYear}
                        onChange={e => setStatusYear(e.target.value)}
                        className="bg-amber-50 border border-amber-100 text-amber-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-amber-300 transition-all"
                      >
                        <option value="all">ทั้งหมด (All time)</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                      </select>
                    </>
                  )}
                  {activeGraph === 'daily' && (
                    <>
                      <h2 className="font-bold text-gray-700 text-lg flex items-center">
                        <FontAwesomeIcon icon={faChartLine} className="text-blue-500 mr-2" />แนวโน้มรายวัน (Daily Trend)
                      </h2>
                      <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-blue-300 transition-all"
                      >
                        {availableMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
                      </select>
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
                  {activeGraph === 'yoy' && (
                    <h2 className="font-bold text-gray-700 text-lg flex items-center">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-amber-500 mr-2" />เปรียบเทียบรายปี (YoY)
                    </h2>
                  )}
                </div>

                <GraphTabs
                  activeTab={activeGraph}
                  onTabChange={setActiveGraph}
                  tabs={[
                    { key: 'status', label: 'Status', icon: faChartPie, activeColor: 'text-amber-600' },
                    { key: 'daily', label: 'Daily', icon: faChartLine, activeColor: 'text-blue-600' },
                    { key: 'monthly', label: 'Monthly', icon: faChartBar, activeColor: 'text-violet-600' },
                    { key: 'yoy', label: 'YoY', icon: faCalendarDays, activeColor: 'text-emerald-600' },
                  ]}
                />
              </div>

              <div className="w-full relative flex-1 min-h-[400px]">
                {activeGraph === 'status' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    <div className="lg:col-span-1 h-[350px]">
                      <h3 className="text-center font-bold text-gray-600 mb-2">ภาพรวมความครอบคลุม</h3>
                      {coveragePieConfig && <ApexChart options={coveragePieConfig.options} series={coveragePieConfig.series} type="donut" height={300} />}
                    </div>
                    <div className="lg:col-span-2 h-[400px]">
                      <h3 className="text-center font-bold text-gray-600 mb-2">รายละเอียดกลุ่มที่ประเมินแล้ว</h3>
                      {statusData && <ChartCanvas id="statusBarChart" type="bar" data={statusData} hideLegend={true} options={{ indexAxis: 'y', maintainAspectRatio: false }} />}
                    </div>
                  </div>
                )}
                {activeGraph === 'daily' && dailyData && (
                  <ChartCanvas id="dailyChart" type="bar" data={dailyData} hideLegend={true} options={{ maintainAspectRatio: false }} />
                )}
                {activeGraph === 'monthly' && monthlyData && (
                  <ChartCanvas id="monthlyChart" type="bar" data={monthlyData} hideLegend={true} options={{ maintainAspectRatio: false }} />
                )}
                {activeGraph === 'yoy' && yoyData && (
                  <ChartCanvas id="depressionYoyChart" type="line" data={yoyData} hideLegend={false} options={{ maintainAspectRatio: false }} />
                )}
              </div>
            </GlassCard>
          </>
        )}
      </div>
      <UnassessedModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
