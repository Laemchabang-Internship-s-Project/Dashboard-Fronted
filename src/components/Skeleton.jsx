import React from 'react';

/* ──────────────────────────────────────────────────────────
   Skeleton Primitives
   ────────────────────────────────────────────────────────── */

/** แท่ง shimmer พื้นฐาน */
export function SkeletonBox({ className = '' }) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg ${className}`}
    />
  );
}

/* ──────────────────────────────────────────────────────────
   Stat Card Skeleton  (ใช้ใน Overview & SummaryOPD)
   ────────────────────────────────────────────────────────── */
export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-[6px]`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-[14px] p-4 md:p-5 min-h-[120px] md:min-h-[140px] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <SkeletonBox className="w-5 h-5" />
            <SkeletonBox className="h-4 w-32" />
          </div>
          <SkeletonBox className="h-10 w-20 mt-auto" />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   FuelSummaryCard Skeleton
   ────────────────────────────────────────────────────────── */
export function FuelCardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col items-center">
          {/* badge */}
          <SkeletonBox className="h-5 w-24 rounded-full mb-1" />
          <SkeletonBox className="h-4 w-20 rounded-full mb-3" />
          {/* gauge half-circle */}
          <div className="w-full max-w-[160px] mb-2">
            <SkeletonBox className="w-full aspect-[2/1] rounded-t-full" />
            <SkeletonBox className="h-4 w-24 mx-auto mt-2 rounded-full" />
          </div>
          {/* before / after */}
          <div className="flex items-center gap-4 mt-1">
            <div className="text-center">
              <SkeletonBox className="h-3 w-8 mb-1 mx-auto rounded-full" />
              <SkeletonBox className="h-4 w-14 rounded" />
            </div>
            <div className="text-gray-200">→</div>
            <div className="text-center">
              <SkeletonBox className="h-3 w-8 mb-1 mx-auto rounded-full" />
              <SkeletonBox className="h-4 w-14 rounded" />
            </div>
          </div>
          {/* footer */}
          <div className="mt-3 pt-2 border-t border-gray-50 w-full flex flex-col items-center gap-1">
            <SkeletonBox className="h-3 w-28 rounded-full" />
            <SkeletonBox className="h-3 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Chart Skeleton
   ────────────────────────────────────────────────────────── */
export function ChartSkeleton({ height = 250 }) {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <SkeletonBox className="h-5 w-40" />
        <SkeletonBox className="h-4 w-20" />
      </div>
      <SkeletonBox className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Table Skeleton  (ใช้ใน GasInspection)
   ────────────────────────────────────────────────────────── */
export function TableSkeleton({ rows = 6, cols = 13 }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* header toolbar skeleton */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 justify-between items-center">
        <SkeletonBox className="h-5 w-40" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <SkeletonBox key={i} className="h-7 w-16 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <SkeletonBox className="h-3 w-12 rounded-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-t border-gray-50">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="px-3 py-3">
                    <SkeletonBox className={`h-4 rounded-full ${c === 0 ? 'w-4' : c === 1 ? 'w-20' : c === 2 ? 'w-16' : 'w-12'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Wait-time Grid Skeleton  (ใช้ใน SummaryOPD แถว 2)
   ────────────────────────────────────────────────────────── */
export function WaitTimeSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
      {/* gradient box */}
      <div className="lg:col-span-5 bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded-2xl">
        <div className="grid grid-cols-2 gap-y-6 h-full">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col items-center justify-center gap-3 min-h-[100px]">
              <SkeletonBox className="h-3 w-24 rounded-full" />
              <SkeletonBox className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      {/* right cards */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[140px] gap-3">
            <SkeletonBox className="h-4 w-20 rounded-full" />
            <SkeletonBox className="h-14 w-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Header Skeleton (มีในทุกหน้า)
   ────────────────────────────────────────────────────────── */
export function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap justify-between items-center gap-3 mb-6 bg-white/60 backdrop-blur-sm p-4 md:p-5 rounded-2xl border border-white/40 shadow-sm">
      <div className="flex flex-col gap-2">
        <SkeletonBox className="h-7 w-40" />
        <SkeletonBox className="h-4 w-56" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-9 w-28 rounded-lg" />
        <SkeletonBox className="h-9 w-28 rounded-lg" />
        <SkeletonBox className="h-9 w-16 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-5 w-32 hidden sm:block" />
        <SkeletonBox className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}
