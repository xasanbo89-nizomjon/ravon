import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  Coins,
  CheckCircle2,
  BarChart3,
  Calendar,
  Eye,
} from 'lucide-react';
import { OrderRecord } from '../../types';
import { formatUzbekSum } from '../../utils/formatters';

interface StorePerformanceChartsProps {
  orders: OrderRecord[];
}

interface DailyMetricPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  orderCount: number;
  completedCount: number;
  revenue: number;
  averageOrderValue: number;
}

const UZ_MONTHS_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

function formatLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCompactUzs(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

export const StorePerformanceCharts: React.FC<StorePerformanceChartsProps> = ({
  orders,
}) => {
  const [chartView, setChartView] = useState<'combined' | 'revenue' | 'orders'>('combined');
  const [daysWindow, setDaysWindow] = useState<30 | 14 | 7>(30);
  const [showDemoPreview, setShowDemoPreview] = useState<boolean>(false);

  const dailySeries = useMemo<DailyMetricPoint[]>(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pointsMap = new Map<string, DailyMetricPoint>();
    const points: DailyMetricPoint[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(todayStart.getDate() - i);
      const dateKey = formatLocalDateKey(d);
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthShort = UZ_MONTHS_SHORT[d.getMonth()];
      const label = `${dayNum} ${monthShort}`;
      const fullDate = `${dayNum} ${monthShort} ${d.getFullYear()}-yil`;

      const point: DailyMetricPoint = {
        dateKey,
        label,
        fullDate,
        orderCount: 0,
        completedCount: 0,
        revenue: 0,
        averageOrderValue: 0,
      };
      pointsMap.set(dateKey, point);
      points.push(point);
    }

    if (showDemoPreview) {
      // Deterministic realistic 30-day sample curve for previewing chart capabilities
      points.forEach((pt, idx) => {
        const wave = Math.sin(idx * 0.45) * 2 + Math.cos(idx * 0.25) * 1.5;
        const baseOrders = Math.max(1, Math.round(3 + wave + (idx / 30) * 3));
        const avgPrice = 420_000 + ((idx * 73_000) % 380_000);
        pt.orderCount = baseOrders;
        pt.completedCount = Math.max(1, baseOrders - (idx % 3 === 0 ? 1 : 0));
        pt.revenue = baseOrders * avgPrice;
        pt.averageOrderValue = Math.round(pt.revenue / pt.orderCount);
      });
      return points;
    }

    for (const order of orders) {
      if (!order.createdAt) continue;
      const parsed = new Date(order.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = formatLocalDateKey(parsed);
      const bucket = pointsMap.get(key);
      if (!bucket) continue;

      bucket.orderCount += 1;
      if (order.status === 'Bajarildi') {
        bucket.completedCount += 1;
      }
      if (order.status !== 'Bekor qilindi') {
        bucket.revenue += Number(order.totalAmount) || 0;
      }
      bucket.averageOrderValue =
        bucket.orderCount > 0 ? Math.round(bucket.revenue / bucket.orderCount) : 0;
    }

    return points;
  }, [orders, showDemoPreview]);

  const visibleSeries = useMemo(() => {
    return dailySeries.slice(30 - daysWindow);
  }, [dailySeries, daysWindow]);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let completedOrders = 0;
    let peakDayLabel = '—';
    let peakDayRevenue = 0;

    for (const day of visibleSeries) {
      totalRevenue += day.revenue;
      totalOrders += day.orderCount;
      completedOrders += day.completedCount;
      if (day.revenue > peakDayRevenue) {
        peakDayRevenue = day.revenue;
        peakDayLabel = day.label;
      }
    }

    // Compare second half of window vs first half for trend percentage
    const half = Math.floor(visibleSeries.length / 2);
    const firstHalfRev = visibleSeries
      .slice(0, half)
      .reduce((acc, d) => acc + d.revenue, 0);
    const secondHalfRev = visibleSeries
      .slice(half)
      .reduce((acc, d) => acc + d.revenue, 0);

    const growthPercent =
      firstHalfRev > 0
        ? Math.round(((secondHalfRev - firstHalfRev) / firstHalfRev) * 100)
        : secondHalfRev > 0
        ? 100
        : 0;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalRevenue,
      totalOrders,
      completedOrders,
      avgOrderValue,
      peakDayLabel,
      peakDayRevenue,
      growthPercent,
    };
  }, [visibleSeries]);

  return (
    <div className="bg-[#12141e] border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-red-950/80 border border-red-800/70 text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-red-500" />
              <span>Do‘kon Samaradorligi Tahlili</span>
            </span>
            {showDemoPreview && (
              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] font-mono font-bold uppercase">
                Namuna (Demo) Rejimi
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-racing font-bold text-white tracking-wide mt-1.5">
            Oxirgi {daysWindow} Kunlik Buyurtmalar Trendi va Umumiy Daromad
          </h3>
          <p className="text-xs text-zinc-400">
            Kunlik tushum (bekor qilinmagan buyurtmalar bo‘yicha) hamda buyurtmalar dinamikasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Demo toggle when store has few or zero orders */}
          <button
            type="button"
            onClick={() => setShowDemoPreview((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              showDemoPreview
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Grafikni namuna ma'lumotlar bilan tekshirish"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showDemoPreview ? 'Real ma‘lumotga qaytish' : 'Demo grafik'}</span>
          </button>

          {/* Date Window Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setDaysWindow(days)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition ${
                  daysWindow === days
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {days} kun
              </button>
            ))}
          </div>

          {/* Chart Type Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setChartView('combined')}
              className={`px-2.5 py-1 rounded-lg font-racing font-bold transition ${
                chartView === 'combined'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Qo‘shma
            </button>
            <button
              type="button"
              onClick={() => setChartView('revenue')}
              className={`px-2.5 py-1 rounded-lg font-racing font-bold transition ${
                chartView === 'revenue'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Daromad
            </button>
            <button
              type="button"
              onClick={() => setChartView('orders')}
              className={`px-2.5 py-1 rounded-lg font-racing font-bold transition ${
                chartView === 'orders'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Buyurtmalar
            </button>
          </div>
        </div>
      </div>

      {/* 30-Day KPI Strip (Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/90 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              {daysWindow} Kunlik Jami Tushum
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-white mt-1 tabular-nums">
              {formatUzbekSum(summary.totalRevenue)}
            </div>
            <div className="text-[11px] font-mono mt-1 flex items-center gap-1">
              <span
                className={
                  summary.growthPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                }
              >
                {summary.growthPercent >= 0 ? `+${summary.growthPercent}%` : `${summary.growthPercent}%`}
              </span>
              <span className="text-zinc-500">davr dinamikasi</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800/50 text-red-400">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/90 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              {daysWindow} Kunlik Buyurtmalar
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-white mt-1 tabular-nums">
              {summary.totalOrders} ta
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1 tabular-nums">
              Kuniga o‘rtacha: {(summary.totalOrders / daysWindow).toFixed(1)} ta
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/90 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              O‘rtacha Chek (AOV)
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
              {formatUzbekSum(summary.avgOrderValue)}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-1 tabular-nums">
              Bajarilgan: {summary.completedOrders} ta
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/90 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Eng Yuqori Savdo Kuni
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
              {summary.peakDayLabel}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono mt-1 tabular-nums">
              {summary.peakDayRevenue > 0
                ? formatUzbekSum(summary.peakDayRevenue)
                : 'Savdo qayd etilmagan'}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="pt-2">
        <div className="h-72 sm:h-80 w-full bg-[#0b0d14] border border-zinc-800/90 rounded-xl p-3 sm:p-4">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'combined' ? (
              <ComposedChart
                data={visibleSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  minTickGap={16}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  stroke="#71717a"
                  tickFormatter={formatCompactUzs}
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <YAxis
                  yAxisId="orders"
                  orientation="right"
                  allowDecimals={false}
                  stroke="#f59e0b"
                  tick={{ fill: '#fbbf24', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload as DailyMetricPoint;
                    return (
                      <div className="bg-[#12141e] border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-mono">
                        <div className="text-zinc-300 font-bold border-b border-zinc-800 pb-1">
                          {data.fullDate}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Kunlik daromad:</span>
                          <span className="text-red-400 font-bold tabular-nums">
                            {formatUzbekSum(data.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Buyurtmalar soni:</span>
                          <span className="text-amber-400 font-bold tabular-nums">
                            {data.orderCount} ta
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Bajarilgan:</span>
                          <span className="text-emerald-400 font-bold tabular-nums">
                            {data.completedCount} ta
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Daromad (so'm)"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revGradient)"
                />
                <Bar
                  yAxisId="orders"
                  dataKey="orderCount"
                  name="Buyurtmalar (ta)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={14}
                />
              </ComposedChart>
            ) : chartView === 'revenue' ? (
              <AreaChart
                data={visibleSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revOnlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  minTickGap={16}
                />
                <YAxis
                  stroke="#71717a"
                  tickFormatter={formatCompactUzs}
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={54}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload as DailyMetricPoint;
                    return (
                      <div className="bg-[#12141e] border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-mono">
                        <div className="text-zinc-300 font-bold border-b border-zinc-800 pb-1">
                          {data.fullDate}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Jami daromad:</span>
                          <span className="text-emerald-400 font-bold tabular-nums">
                            {formatUzbekSum(data.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">O‘rtacha chek:</span>
                          <span className="text-zinc-200 font-bold tabular-nums">
                            {formatUzbekSum(data.averageOrderValue)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Daromad"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revOnlyGradient)"
                />
              </AreaChart>
            ) : (
              <BarChart
                data={visibleSeries}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2430" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#71717a"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#71717a"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload as DailyMetricPoint;
                    return (
                      <div className="bg-[#12141e] border border-zinc-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-mono">
                        <div className="text-zinc-300 font-bold border-b border-zinc-800 pb-1">
                          {data.fullDate}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Jami buyurtmalar:</span>
                          <span className="text-amber-400 font-bold tabular-nums">
                            {data.orderCount} ta
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-zinc-400">Bajarilgan:</span>
                          <span className="text-emerald-400 font-bold tabular-nums">
                            {data.completedCount} ta
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="orderCount"
                  name="Jami buyurtmalar"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Bar
                  dataKey="completedCount"
                  name="Bajarilgan"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend & Helper Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 text-[11px] text-zinc-400">
          <div className="flex flex-wrap items-center gap-4">
            {chartView === 'combined' && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                  <span>Kunlik daromad (so‘m — chap o‘q)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  <span>Kunlik buyurtmalar soni (ta — o‘ng o‘q)</span>
                </span>
              </>
            )}
            {chartView === 'revenue' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                <span>Kunlik tushum dinamikasi (so‘m)</span>
              </span>
            )}
            {chartView === 'orders' && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  <span>Barcha kelgan buyurtmalar</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span>Muvaffaqiyatli bajarilgan buyurtmalar</span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500 font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
            <span>Real vaqtda buyurtmalar bazasidan hisoblanadi</span>
          </div>
        </div>
      </div>
    </div>
  );
};
