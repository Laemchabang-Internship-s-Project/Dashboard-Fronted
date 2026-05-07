import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave, faChartBar, faCalendarDays, faCalendar,
  faUsers, faIdCard, faCheckCircle, faTriangleExclamation,
  faCoins, faCreditCard, faFileInvoiceDollar, faLayerGroup,
  faHeartPulse,
} from '@fortawesome/free-solid-svg-icons';
import { apiGetInternal } from '../services/api';
import { HeaderSkeleton, ChartSkeleton } from '../components/Skeleton';
import { ChartCanvas, MONTH_NAMES, CHART_COLORS } from '../components/ChartComponents';
import {
  DashboardStyles, MetricCard, GlassCard, SectionHeader,
  DashboardHeader, ErrorMessage, GraphTabs,
} from '../components/DashboardUI';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toLocaleString('th-TH');
const fmtBaht = (n) => `฿${Math.round(n ?? 0).toLocaleString('th-TH')}`;

const START_YEAR = 2022;
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - START_YEAR + 1 },
  (_, i) => String(new Date().getFullYear() - i)
);
const CURRENT_YEAR = new Date().getFullYear().toString();
const CURRENT_MONTH = `${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

// ─── กลุ่มสิทธิ์ (pttype_code → group name) ───────────────────────────────────
// Mapping ตามมาตรฐานโรงพยาบาลรัฐบาลไทย (ปรับได้ตามฐานข้อมูลจริง)
const PTTYPE_GROUP_MAP = {
  // บัตรทอง / UC
  UC: ['uc', 'ucl', '89', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88'],
  // ข้าราชการ / รัฐวิสาหกิจ
  'ข้าราชการ': ['of', 'oc', '01', '02', '03', '11', '12', '13', '14', '15'],
  // ประกันสังคม
  'ประกันสังคม': ['ss', 'ssi', '30', '31', '32', '33', '34', '35'],
  // ชำระเงินเอง
  'ชำระเงินเอง': ['ca', 'cash', '00', '90', '91', '92', '93'],
  // อื่นๆ
  'อื่นๆ': [],
};

/**
 * จัดกลุ่ม pttype_code → ชื่อกลุ่ม
 * ถ้าไม่ตรง pattern ไหนเลย → "อื่นๆ"
 */
function getPttypeGroup(code = '') {
  const c = String(code).toLowerCase().trim();
  for (const [group, codes] of Object.entries(PTTYPE_GROUP_MAP)) {
    if (group === 'อื่นๆ') continue;
    if (codes.some(k => c === k || c.startsWith(k))) return group;
  }
  return 'อื่นๆ';
}

/** รวม rows เป็น Top N + อื่นๆ (เรียงตาม total_amount) */
function buildTop10Others(rows, n = 10) {
  if (!rows || rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => (b.total_amount ?? 0) - (a.total_amount ?? 0));
  if (sorted.length <= n) return sorted;
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const others = rest.reduce((acc, r) => ({
    pttype_code: 'others',
    pttype_name: `อื่นๆ (${rest.length} สิทธิ์)`,
    total_patients: acc.total_patients + (r.total_patients ?? 0),
    total_visits: acc.total_visits + (r.total_visits ?? 0),
    cash_amount: acc.cash_amount + (r.cash_amount ?? 0),
    debtor_amount: acc.debtor_amount + (r.debtor_amount ?? 0),
    unpaid_amount: acc.unpaid_amount + (r.unpaid_amount ?? 0),
    total_amount: acc.total_amount + (r.total_amount ?? 0),
  }), { total_patients: 0, total_visits: 0, cash_amount: 0, debtor_amount: 0, unpaid_amount: 0, total_amount: 0 });
  return [...top, others];
}

/** Baht axis tick formatter */
const bahtTick = v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v;

/** Horizontal bar shared options */
const hBarOptions = (extra = {}) => ({
  indexAxis: 'y',
  maintainAspectRatio: false,
  layout: { padding: { right: 10 } },
  scales: {
    x: {
      ticks: { callback: bahtTick, font: { family: "'Sarabun', sans-serif", size: 11 } },
      grid: { color: '#f1f5f9' },
    },
    y: {
      ticks: { font: { family: "'Sarabun', sans-serif", size: 11 }, autoSkip: false },
      grid: { display: false },
    },
  },
  plugins: {
    datalabels: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ฿${ctx.raw.toLocaleString('th-TH')}`,
      },
    },
  },
  ...extra,
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceGraph() {
  const [activeTab, setActiveTab] = useState('by_pttype');
  const [kpi, setKpi] = useState(null);
  const [byPttypeRows, setByPttypeRows] = useState([]);
  const [yearlyRows, setYearlyRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);

  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchView = useCallback(async (view, params = {}) => {
    try {
      let url = `/api/finance/summary?view=${view}`;
      if (params.year) url += `&year=${params.year}`;
      if (params.month) url += `&month=${params.month}`;
      const res = await apiGetInternal(url);
      if (!res || res.status !== 'success') throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
      return res.data;
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
      return null;
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    const [kpiData, ptypeData, yearlyData, monthlyData, dailyData] = await Promise.all([
      fetchView('kpi'),
      fetchView('by_pttype'),
      fetchView('yearly'),
      fetchView('monthly', { year: filterYear }),
      fetchView('daily', { month: filterMonth }),
    ]);
    if (kpiData) setKpi(kpiData);
    if (ptypeData) setByPttypeRows(ptypeData);
    if (yearlyData) setYearlyRows(yearlyData);
    if (monthlyData) setMonthlyRows(monthlyData);
    if (dailyData) setDailyRows(dailyData);
    setLoading(false);
  }, [fetchView, filterYear, filterMonth]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAll();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // ── Chart data ───────────────────────────────────────────────────────────

  /** ทุกสิทธิ์ เรียงจากมากไปน้อย */
  const sortedRows = useMemo(() =>
    [...byPttypeRows].sort((a, b) => (b.total_amount ?? 0) - (a.total_amount ?? 0)),
    [byPttypeRows]
  );

  /** Horizontal bar: ทุกสิทธิ์ */
  const byPttypeChartData = useMemo(() => {
    if (!sortedRows.length) return null;
    const labels = sortedRows.map(r => r.pttype_name || r.pttype_code || 'ไม่ระบุ');
    return {
      labels,
      datasets: [
        {
          label: 'เงินสด',
          data: sortedRows.map(r => Math.round(r.cash_amount ?? 0)),
          backgroundColor: '#10b981', legendColor: '#10b981', borderRadius: 4,
        },
        {
          label: 'เบิกสิทธิ์',
          data: sortedRows.map(r => Math.round(r.debtor_amount ?? 0)),
          backgroundColor: '#3b82f6', legendColor: '#3b82f6', borderRadius: 4,
        },
        {
          label: 'ค้างชำระ',
          data: sortedRows.map(r => Math.round(r.unpaid_amount ?? 0)),
          backgroundColor: '#f59e0b', legendColor: '#f59e0b', borderRadius: 4,
        },
      ],
    };
  }, [sortedRows]);

  /** Group by กลุ่มสิทธิ์ */
  const groupedRows = useMemo(() => {
    if (!byPttypeRows.length) return [];
    const map = {};
    byPttypeRows.forEach(r => {
      const g = getPttypeGroup(r.pttype_code);
      if (!map[g]) map[g] = { group: g, cash_amount: 0, debtor_amount: 0, unpaid_amount: 0, total_amount: 0, total_patients: 0, total_visits: 0, count: 0 };
      map[g].cash_amount += r.cash_amount ?? 0;
      map[g].debtor_amount += r.debtor_amount ?? 0;
      map[g].unpaid_amount += r.unpaid_amount ?? 0;
      map[g].total_amount += r.total_amount ?? 0;
      map[g].total_patients += r.total_patients ?? 0;
      map[g].total_visits += r.total_visits ?? 0;
      map[g].count++;
    });
    return Object.values(map).sort((a, b) => b.total_amount - a.total_amount);
  }, [byPttypeRows]);

  const groupedChartData = useMemo(() => {
    if (!groupedRows.length) return null;
    return {
      labels: groupedRows.map(g => g.group),
      datasets: [
        {
          label: 'เงินสด',
          data: groupedRows.map(g => Math.round(g.cash_amount)),
          backgroundColor: '#10b981', legendColor: '#10b981', borderRadius: 6,
        },
        {
          label: 'เบิกสิทธิ์',
          data: groupedRows.map(g => Math.round(g.debtor_amount)),
          backgroundColor: '#3b82f6', legendColor: '#3b82f6', borderRadius: 6,
        },
        {
          label: 'ค้างชำระ',
          data: groupedRows.map(g => Math.round(g.unpaid_amount)),
          backgroundColor: '#f59e0b', legendColor: '#f59e0b', borderRadius: 6,
        },
      ],
    };
  }, [groupedRows]);

  const monthlyChartData = useMemo(() => {
    if (!monthlyRows.length) return null;
    return {
      labels: monthlyRows.map(r => {
        if (!r.year || !r.month) return '';
        return `${MONTH_NAMES[parseInt(r.month, 10) - 1]} ${r.year.slice(2)}`;
      }),
      datasets: [
        {
          label: 'ยอดรวม',
          data: monthlyRows.map(r => Math.round(r.total_amount ?? 0)),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          type: 'line',
        },
        {
          label: 'เงินสด',
          data: monthlyRows.map(r => Math.round(r.cash_amount ?? 0)),
          backgroundColor: 'rgba(16,185,129,0.7)',
          legendColor: '#10b981',
          borderRadius: 4,
        },
        {
          label: 'เบิกสิทธิ์',
          data: monthlyRows.map(r => Math.round(r.debtor_amount ?? 0)),
          backgroundColor: 'rgba(59,130,246,0.7)',
          legendColor: '#3b82f6',
          borderRadius: 4,
        },
        {
          label: 'ค้างชำระ',
          data: monthlyRows.map(r => Math.round(r.unpaid_amount ?? 0)),
          backgroundColor: 'rgba(245,158,11,0.7)',
          legendColor: '#f59e0b',
          borderRadius: 4,
        },
      ],
    };
  }, [monthlyRows]);

  const yearlyChartData = useMemo(() => {
    if (!yearlyRows.length) return null;
    return {
      labels: yearlyRows.map(r => r.year || ''),
      datasets: [
        {
          label: 'ยอดรวม',
          data: yearlyRows.map(r => Math.round(r.total_amount ?? 0)),
          borderColor: '#d946ef',
          backgroundColor: 'rgba(217,70,239,0.15)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          type: 'line',
        },
        {
          label: 'เงินสด',
          data: yearlyRows.map(r => Math.round(r.cash_amount ?? 0)),
          backgroundColor: 'rgba(16,185,129,0.7)',
          legendColor: '#10b981',
          borderRadius: 4,
        },
        {
          label: 'เบิกสิทธิ์',
          data: yearlyRows.map(r => Math.round(r.debtor_amount ?? 0)),
          backgroundColor: 'rgba(59,130,246,0.7)',
          legendColor: '#3b82f6',
          borderRadius: 4,
        },
        {
          label: 'ค้างชำระ',
          data: yearlyRows.map(r => Math.round(r.unpaid_amount ?? 0)),
          backgroundColor: 'rgba(245,158,11,0.7)',
          legendColor: '#f59e0b',
          borderRadius: 4,
        },
      ],
    };
  }, [yearlyRows]);

  const dailyChartData = useMemo(() => {
    if (!dailyRows.length) return null;
    return {
      labels: dailyRows.map(r => {
        if (!r.date) return '';
        const [y, m, d] = r.date.split('-');
        return `${parseInt(d, 10)} ${MONTH_NAMES[parseInt(m, 10) - 1]}`;
      }),
      datasets: [
        {
          label: 'ยอดรวม',
          data: dailyRows.map(r => Math.round(r.total_amount ?? 0)),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.12)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 3,
          fill: true,
          type: 'line',
        },
        {
          label: 'เงินสด',
          data: dailyRows.map(r => Math.round(r.cash_amount ?? 0)),
          backgroundColor: 'rgba(16,185,129,0.6)',
          legendColor: '#10b981',
          borderRadius: 3,
        },
        {
          label: 'เบิกสิทธิ์',
          data: dailyRows.map(r => Math.round(r.debtor_amount ?? 0)),
          backgroundColor: 'rgba(59,130,246,0.6)',
          legendColor: '#3b82f6',
          borderRadius: 3,
        },
        {
          label: 'ค้างชำระ',
          data: dailyRows.map(r => Math.round(r.unpaid_amount ?? 0)),
          backgroundColor: 'rgba(245,158,11,0.6)',
          legendColor: '#f59e0b',
          borderRadius: 3,
        },
      ],
    };
  }, [dailyRows]);

  // ── KPI Totals ───────────────────────────────────────────────────────────
  const totalByPttype = useMemo(() => {
    return byPttypeRows.reduce((a, r) => ({
      patients: a.patients + (r.total_patients ?? 0),
      total: a.total + (r.total_amount ?? 0),
      cash: a.cash + (r.cash_amount ?? 0),
      unpaid: a.unpaid + (r.unpaid_amount ?? 0),
    }), { patients: 0, total: 0, cash: 0, unpaid: 0 });
  }, [byPttypeRows]);

  // ── Tab config ───────────────────────────────────────────────────────────
  const TABS = [
    { key: 'by_pttype', label: 'แยกสิทธิ์', icon: faIdCard, activeColor: 'text-emerald-600' },
    { key: 'by_group', label: 'กลุ่มสิทธิ์', icon: faLayerGroup, activeColor: 'text-sky-600' },
    { key: 'yearly', label: 'รายปี', icon: faChartBar, activeColor: 'text-fuchsia-600' },
    { key: 'monthly', label: 'รายเดือน', icon: faCalendar, activeColor: 'text-indigo-600' },
    { key: 'daily', label: 'รายวัน', icon: faCalendarDays, activeColor: 'text-violet-600' },
  ];

  const isFirstLoad = loading && !byPttypeRows.length && !kpi;

  return (
    <div
      className="p-3 md:p-6 min-h-screen"
      style={{ fontFamily: "'Sarabun', sans-serif", background: 'linear-gradient(180deg, #f0fdf4 0%, #eff6ff 100%)' }}
    >
      <Helmet><title>Finance Dashboard - LCBH</title></Helmet>
      <DashboardStyles />

      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        {isFirstLoad ? (
          <div className="space-y-6">
            <HeaderSkeleton />
            <ChartSkeleton height={500} />
          </div>
        ) : (
          <>
            {/* Header */}
            <DashboardHeader
              title="Finance Dashboard"
              subtitle="สรุปรายรับ / การเงินโรงพยาบาล"
              icon={faMoneyBillWave}
              iconColorClass="text-emerald-500"
              statusColorClass="bg-emerald-100 text-emerald-700"
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
            />

            <ErrorMessage error={error} />

            {/* ── KPI Row 1: ยอดตามปฏิทิน (Calendar-based) ── */}
            {kpi && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
                  <MetricCard
                    label="รายรับวันนี้"
                    value={fmtBaht(kpi.today_total)}
                    icon={faCoins}
                    color="bg-emerald-500"
                  />
                  <MetricCard
                    label="รายรับเดือนนี้"
                    value={fmtBaht(kpi.month_total)}
                    icon={faFileInvoiceDollar}
                    color="bg-indigo-500"
                  />
                  <MetricCard
                    label="รายรับปีนี้ (ตั้งแต่ 1 ม.ค.)"
                    value={fmtBaht(kpi.year_total)}
                    icon={faChartBar}
                    color="bg-violet-500"
                  />
                  <MetricCard
                    label="ค้างชำระปีนี้"
                    value={fmtBaht(kpi.year_unpaid ?? 0)}
                    icon={faTriangleExclamation}
                    color="bg-amber-500"
                  />
                </div>
              </>
            )}

            {/* ── KPI Row 2: ยอดย้อนหลัง 365 วัน (Rolling Year) ── */}
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up">
                <MetricCard
                  label="ผู้รับบริการ (365 วันล่าสุด)"
                  value={fmt(totalByPttype.patients)}
                  icon={faUsers}
                  color="bg-blue-500"
                />
                <MetricCard
                  label="รายรับรวม (365 วันล่าสุด)"
                  value={fmtBaht(totalByPttype.total)}
                  icon={faMoneyBillWave}
                  color="bg-teal-500"
                />
                <MetricCard
                  label="ชำระเงินสด (365 วันล่าสุด)"
                  value={fmtBaht(totalByPttype.cash)}
                  icon={faCheckCircle}
                  color="bg-green-500"
                />
                <MetricCard
                  label="ยังค้างชำระ (365 วันล่าสุด)"
                  value={fmtBaht(totalByPttype.unpaid)}
                  icon={faCreditCard}
                  color="bg-rose-500"
                />
              </div>
            </>

            {/* Chart Card */}
            <GlassCard className="animate-fade-up">
              {/* Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-5">
                <div className="flex flex-wrap items-center gap-3">
                  {activeTab === 'by_pttype' && (
                    <SectionHeader
                      title="รายรับแยกตามสิทธิ์ (365 วันล่าสุด)"
                      icon={faHeartPulse}
                      colorClass="bg-emerald-100"
                      subtitle={`${sortedRows.length} สิทธิ์ เรียงจากรายรับมากไปน้อย`}
                    />
                  )}
                  {activeTab === 'by_group' && (
                    <SectionHeader
                      title="แยกตามกลุ่มสิทธิ์ (365 วันล่าสุด)"
                      icon={faLayerGroup}
                      colorClass="bg-sky-500"
                      subtitle="บัตรทอง / ข้าราชการ / ประกันสังคม / ชำระเอง / อื่นๆ"
                    />
                  )}
                  {activeTab === 'yearly' && (
                    <SectionHeader
                      title="รายรับรายปี"
                      icon={faChartBar}
                      colorClass="bg-fuchsia-500"
                    />
                  )}
                  {activeTab === 'monthly' && (
                    <>
                      <SectionHeader
                        title={`รายรับรายเดือน ปี ${filterYear}`}
                        icon={faCalendar}
                        colorClass="bg-indigo-500"
                      />
                      <select
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value)}
                        className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-indigo-400 transition-all"
                      >
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </>
                  )}
                  {activeTab === 'daily' && (
                    <>
                      <SectionHeader
                        title={`รายรับรายวัน เดือน ${filterMonth}`}
                        icon={faCalendarDays}
                        colorClass="bg-violet-100"
                      />
                      <select
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="bg-violet-50 border border-violet-200 text-violet-700 text-sm font-bold rounded-lg px-3 py-1.5 outline-none hover:border-violet-400 transition-all"
                      >
                        {YEAR_OPTIONS.flatMap(y =>
                          [...MONTH_NAMES].reverse().map((m, i) => {
                            const monthNum = MONTH_NAMES.length - i; // 12 → 1
                            const val = `${y}-${String(monthNum).padStart(2, '0')}`;
                            return <option key={val} value={val}>{m} {y}</option>;
                          })
                        )}
                      </select>
                    </>
                  )}
                </div>

                <GraphTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
              </div>

              {/* Charts */}
              <div className="min-h-[450px]">
                {/* ── Tab: Top 10 สิทธิ์ ── */}
                {activeTab === 'by_pttype' && (
                  <div className="w-full" style={{ height: `${Math.max(400, sortedRows.length * 48)}px` }}>
                    {byPttypeChartData ? (
                      <ChartCanvas
                        id="finByPttypeChart"
                        type="bar"
                        data={byPttypeChartData}
                        options={hBarOptions()}
                      />
                    ) : <EmptyState />}
                  </div>
                )}

                {/* ── Tab: กลุ่มสิทธิ์ ── */}
                {activeTab === 'by_group' && (
                  <div className="w-full">
                    {groupedChartData ? (
                      <>
                        {/* กราฟ: ใส่ height เฉพาะส่วนนี้ */}
                        <div style={{ height: `${Math.max(280, groupedRows.length * 72)}px` }}>
                          <ChartCanvas
                            id="finGroupedChart"
                            type="bar"
                            data={groupedChartData}
                            options={hBarOptions({ layout: { padding: { right: 20 } } })}
                          />
                        </div>

                        {/* ตาราง: ไม่มี height fixed ปล่อย flow ตามปกติ */}
                        <div className="mt-8 overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="text-xs text-gray-500 border-b border-gray-100">
                                <th className="py-2 pr-4 font-semibold">กลุ่มสิทธิ์</th>
                                <th className="py-2 pr-4 font-semibold text-right">จำนวนสิทธิ์</th>
                                <th className="py-2 pr-4 font-semibold text-right">ผู้ป่วย</th>
                                <th className="py-2 pr-4 font-semibold text-right text-emerald-600">เงินสด</th>
                                <th className="py-2 pr-4 font-semibold text-right text-blue-600">เบิกสิทธิ์</th>
                                <th className="py-2 pr-4 font-semibold text-right text-amber-600">ค้างชำระ</th>
                                <th className="py-2 font-semibold text-right">รวม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedRows.map((g, i) => (
                                <tr key={i} className="border-b border-gray-50 hover:bg-white/60 transition-colors">
                                  <td className="py-2 pr-4 font-semibold text-gray-800">
                                    <span className="inline-block w-2 h-2 rounded-full mr-2"
                                      style={{ backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][i % 5] }} />
                                    {g.group}
                                  </td>
                                  <td className="py-2 pr-4 text-right text-gray-500">{g.count} สิทธิ์</td>
                                  <td className="py-2 pr-4 text-right text-gray-600">{fmt(g.total_patients)}</td>
                                  <td className="py-2 pr-4 text-right text-emerald-700 font-semibold">{fmtBaht(g.cash_amount)}</td>
                                  <td className="py-2 pr-4 text-right text-blue-700 font-semibold">{fmtBaht(g.debtor_amount)}</td>
                                  <td className="py-2 pr-4 text-right text-amber-700 font-semibold">{fmtBaht(g.unpaid_amount)}</td>
                                  <td className="py-2 text-right font-bold text-gray-800">{fmtBaht(g.total_amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : <EmptyState />}
                  </div>
                )}

                {activeTab === 'monthly' && (
                  <div className="h-[450px] w-full">
                    {monthlyChartData ? (
                      <ChartCanvas
                        id="finMonthlyChart"
                        type="bar"
                        data={monthlyChartData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              ticks: {
                                callback: v => v >= 1_000_000
                                  ? `${(v / 1_000_000).toFixed(1)}M`
                                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v,
                              },
                            },
                          },
                          plugins: { datalabels: { display: false } },
                        }}
                      />
                    ) : (
                      <EmptyState />
                    )}
                  </div>
                )}

                {activeTab === 'yearly' && (
                  <div className="h-[450px] w-full">
                    {yearlyChartData ? (
                      <ChartCanvas
                        id="finYearlyChart"
                        type="bar"
                        data={yearlyChartData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              ticks: {
                                callback: v => v >= 1_000_000
                                  ? `${(v / 1_000_000).toFixed(1)}M`
                                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v,
                              },
                            },
                          },
                          plugins: { datalabels: { display: false } },
                        }}
                      />
                    ) : (
                      <EmptyState />
                    )}
                  </div>
                )}

                {activeTab === 'daily' && (
                  <div className="h-[450px] w-full">
                    {dailyChartData ? (
                      <ChartCanvas
                        id="finDailyChart"
                        type="bar"
                        data={dailyChartData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              ticks: {
                                callback: v => v >= 1_000_000
                                  ? `${(v / 1_000_000).toFixed(1)}M`
                                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v,
                              },
                            },
                          },
                          plugins: { datalabels: { display: false } },
                        }}
                      />
                    ) : (
                      <EmptyState />
                    )}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Table — By Pttype breakdown */}
            {activeTab === 'by_pttype' && byPttypeRows.length > 0 && (
              <GlassCard className="animate-fade-up overflow-x-auto">
                <SectionHeader
                  title="ตารางสรุปแยกสิทธิ์ (365 วันล่าสุด)"
                  icon={faFileInvoiceDollar}
                  colorClass="bg-teal-500"
                />
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="py-2 pr-4 font-semibold">สิทธิ์</th>
                      <th className="py-2 pr-4 font-semibold text-right">ผู้ป่วย</th>
                      <th className="py-2 pr-4 font-semibold text-right">ครั้ง</th>
                      <th className="py-2 pr-4 font-semibold text-right text-emerald-600">เงินสด</th>
                      <th className="py-2 pr-4 font-semibold text-right text-blue-600">เบิกสิทธิ์</th>
                      <th className="py-2 pr-4 font-semibold text-right text-amber-600">ค้างชำระ</th>
                      <th className="py-2 font-semibold text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPttypeRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-white/60 transition-colors">
                        <td className="py-2 pr-4 font-medium text-gray-700">
                          <span className="text-gray-400 mr-1 text-xs">[{r.pttype_code}]</span>
                          {r.pttype_name || 'ไม่ระบุ'}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-600">{fmt(r.total_patients)}</td>
                        <td className="py-2 pr-4 text-right text-gray-600">{fmt(r.total_visits)}</td>
                        <td className="py-2 pr-4 text-right text-emerald-700 font-semibold">{fmtBaht(r.cash_amount)}</td>
                        <td className="py-2 pr-4 text-right text-blue-700 font-semibold">{fmtBaht(r.debtor_amount)}</td>
                        <td className="py-2 pr-4 text-right text-amber-700 font-semibold">{fmtBaht(r.unpaid_amount)}</td>
                        <td className="py-2 text-right font-bold text-gray-800">{fmtBaht(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold text-gray-800">
                      <td className="py-2 pr-4">รวมทั้งหมด</td>
                      <td className="py-2 pr-4 text-right">{fmt(totalByPttype.patients)}</td>
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4 text-right text-emerald-700">{fmtBaht(totalByPttype.cash)}</td>
                      <td className="py-2 pr-4 text-right text-blue-700">{fmtBaht(byPttypeRows.reduce((a, r) => a + (r.debtor_amount ?? 0), 0))}</td>
                      <td className="py-2 pr-4 text-right text-amber-700">{fmtBaht(totalByPttype.unpaid)}</td>
                      <td className="py-2 text-right">{fmtBaht(totalByPttype.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
      <div className="text-5xl mb-3">📊</div>
      <p className="font-semibold text-base text-gray-500">ไม่พบข้อมูล</p>
    </div>
  );
}
