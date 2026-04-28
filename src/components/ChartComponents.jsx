import React, { useEffect, useState, useRef } from 'react';
import Chart from 'chart.js/auto';

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHART_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#d946ef', // Fuchsia
  '#0ea5e9', // Sky
  '#f43f5e', // Rose
];

export const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const MONTH_KEYS  = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * แปลง "YYYY-MM" เป็น "ม.ค. 2568" เป็นต้น
 */
export const formatMonthLabel = (yyyymm) => {
  if (!yyyymm) return '';
  const [year, month] = yyyymm.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
};

// ─── External (HTML) Tooltip Handler ─────────────────────────────────────────
// แยกออกมาเป็น pure function เพื่อให้ ChartCanvas ใช้งานได้ทั้งสองหน้า
// Tooltip นี้จะถูก render เป็น HTML Element จริง ทำให้ล้นนอกกราฟได้

export const createExternalTooltipHandler = () => (context) => {
  const { chart, tooltip } = context;
  let tooltipEl = chart.canvas.parentNode.querySelector('div.custom-chart-tooltip');

  // สร้าง Tooltip Element ครั้งแรก
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'custom-chart-tooltip';
    Object.assign(tooltipEl.style, {
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      borderRadius: '12px',
      color: 'white',
      opacity: 1,
      pointerEvents: 'none',
      position: 'absolute',
      transition: 'all .1s ease',
      zIndex: '1000',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
      padding: '12px',
      minWidth: '200px',
      border: '1px solid rgba(255,255,255,0.1)',
      fontFamily: "'Sarabun', sans-serif",
    });
    chart.canvas.parentNode.appendChild(tooltipEl);
  }

  // ซ่อนเมื่อเมาส์ออก
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // สร้างเนื้อหา
  if (tooltip.body) {
    const titleLines = tooltip.title || [];
    const bodyLines  = tooltip.body.map(b => b.lines);

    let html = `<div style="margin-bottom:8px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:4px;font-size:14px;">
      ${titleLines.map(t => `<span>${t}</span>`).join('')}
    </div>`;

    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    
    // เตรียมข้อมูลและแปลงค่าตัวเลขสำหรับการจัดเรียง
    const sortedItems = bodyLines.map((body, i) => {
      const colors   = tooltip.labelColors[i];
      const parts    = body[0].split(':');
      const label    = parts[0];
      const valStr   = parts.slice(1).join(':').trim(); // ค่าที่เป็น text (เช่น "1,234" หรือ "฿500")
      
      // ลบตัวอักษรที่ไม่ใช่ตัวเลขออกเพื่อใช้ในการเปรียบเทียบค่า
      const numVal = parseFloat(valStr.replace(/[^0-9.-]+/g, '')) || 0;
      
      return { colors, label, valStr, numVal };
    }).sort((a, b) => b.numVal - a.numVal); // จัดเรียงจากมากไปน้อย

    // สร้าง HTML ตามลำดับที่จัดเรียงแล้ว
    sortedItems.forEach((item) => {
      const dot = `<span style="background:${item.colors.backgroundColor};border:2px solid ${item.colors.borderColor};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;flex-shrink:0;"></span>`;

      html += `<div style="display:flex;align-items:center;font-size:13px;justify-content:space-between;gap:15px;">
        <div style="display:flex;align-items:center;">${dot}${item.label}</div>
        <span style="font-weight:700;">${item.valStr}</span>
      </div>`;
    });
    html += '</div>';

    tooltipEl.innerHTML = html;
  }

  // จัดตำแหน่ง — อยู่เหนือจุดที่ชี้
  const { offsetLeft: posX, offsetTop: posY } = chart.canvas;
  tooltipEl.style.opacity   = 1;
  tooltipEl.style.left      = posX + tooltip.caretX + 'px';
  tooltipEl.style.top       = posY + tooltip.caretY + 'px';
  tooltipEl.style.transform = 'translate(-50%, -105%)';
};

// ─── ChartCanvas ──────────────────────────────────────────────────────────────
/**
 * Props:
 *  - id       : string   — unique canvas id
 *  - type     : string   — 'bar' | 'line' | etc.
 *  - data     : object   — Chart.js data object
 *  - options  : object   — Chart.js options (merged with defaults)
 */
export const ChartCanvas = ({ id, type, data, options, hideLegend = false }) => {
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);
  const [hiddenDatasets, setHiddenDatasets] = useState({});

  // Reset hidden state เมื่อ data เปลี่ยน (เช่น กด refresh / เปลี่ยน filter)
  useEffect(() => { setHiddenDatasets({}); }, [data]);

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();

    const externalTooltipHandler = createExternalTooltipHandler();

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
              enabled: false,                // ปิด Tooltip แบบ Canvas
              external: externalTooltipHandler, // ใช้ HTML Tooltip แทน
            },
          },
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                font: { family: "'Sarabun', sans-serif", size: 11 },
                maxRotation: 45,
                minRotation: 0,
              },
              ...options?.scales?.x,
            },
            y: {
              border: { dash: [4, 4] },
              grid: { color: '#f1f5f9' },
              beginAtZero: true,
              ticks: {
                font: { family: "'Sarabun', sans-serif", size: 11 },
                maxTicksLimit: 15,
              },
              ...options?.scales?.y,
            },
          },
          ...options,
        },
      });

      // Re-apply ค่า hidden ที่ยังค้างอยู่หลังสร้างกราฟใหม่
      Object.keys(hiddenDatasets).forEach(idx => {
        if (hiddenDatasets[idx]) {
          chartInstance.current.setDatasetVisibility(Number(idx), false);
        }
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
      {/* Interactive Legend */}
      {!hideLegend && (
        <div
          className="flex md:grid md:grid-cols-6 lg:grid-cols-10 items-center justify-start gap-2 mb-4 md:mb-8 overflow-x-auto md:overflow-visible pb-2 md:pb-0 w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          {data?.datasets?.map((ds, idx) => {
            const isHidden = hiddenDatasets[idx];
            return (
              <button
                key={idx}
                onClick={() => toggleDataset(idx)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all duration-200
                  ${isHidden
                    ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                    : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:shadow hover:-translate-y-0.5'
                  }`}
              >
                <span
                  className={`w-3 h-3 rounded-full ${isHidden ? 'bg-gray-300' : ''}`}
                  style={{
                    backgroundColor: isHidden
                      ? undefined
                      : (ds.legendColor || (Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : ds.backgroundColor) || ds.borderColor),
                  }}
                />
                {ds.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Canvas — overflow visible เพื่อให้ Tooltip ล้นออกนอกได้ */}
      <div className="flex-1 relative w-full h-full min-h-[300px]" style={{ overflow: 'visible' }}>
        <canvas id={id} ref={chartRef} />
      </div>
    </div>
  );
};

// ─── LiveClock ────────────────────────────────────────────────────────────────

export const LiveClock = () => {
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const opts = {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    };
    const tick = () => setCurrentTime(new Date().toLocaleString('th-TH', opts));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <p className="text-gray-600 font-semibold text-sm leading-tight">{currentTime}</p>;
};
