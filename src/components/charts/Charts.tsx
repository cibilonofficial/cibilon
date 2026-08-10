import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactCurrency, formatNumber } from '@/lib/utils';

const AXIS = {
  stroke: '#94a3b8',
  fontSize: 11,
};

const GRID_LINE = '#e2e8f0';

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px -8px rgb(15 45 82 / 0.18)',
  fontSize: 12,
  padding: '8px 10px',
};

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

/**
 * Donut of applications by status, with the total in the middle. The legend is
 * a ranked list rather than recharts' own — with 11 possible statuses the
 * built-in legend wraps into an unreadable block.
 */
export function StatusDonut({ data, total }: { data: StatusSlice[]; total: number }) {
  const visible = data.filter((d) => d.value > 0);

  if (!visible.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
        No applications yet
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {visible.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [`${Number(value)} application(s)`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-2xl font-semibold text-slate-900">{total}</span>
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Total</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
        {visible.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{slice.name}</span>
            <span className="tnum shrink-0 font-medium text-slate-900">{slice.value}</span>
            <span className="tnum w-10 shrink-0 text-right text-xs text-slate-400">
              {Math.round((slice.value / Math.max(1, total)) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TrendPoint {
  month: string;
  submitted: number;
  disbursed: number;
  payout: number;
}

export function VolumeBars({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
        <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: GRID_LINE }} tick={AXIS} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS}
          width={44}
          tickFormatter={(v: number) => formatNumber(v)}
        />
        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={tooltipStyle} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => <span className="text-xs text-slate-600">{value}</span>}
        />
        <Bar dataKey="submitted" name="Submitted" fill="#2b5fa8" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="disbursed" name="Disbursed" fill="#2fa27a" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PayoutTrend({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="payoutFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2fa27a" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#2fa27a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: GRID_LINE }} tick={AXIS} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS}
          width={56}
          tickFormatter={(v: number) => formatCompactCurrency(v)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatCompactCurrency(Number(value)), 'Payout']}
        />
        <Area
          type="monotone"
          dataKey="payout"
          stroke="#2fa27a"
          strokeWidth={2}
          fill="url(#payoutFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ServiceBars({ data }: { data: { name: string; value: number; color: string }[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">
        Nothing to chart yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 38)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={130}
          tick={{ ...AXIS, fill: '#475569' }}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${Number(value)} application(s)`, 'Volume']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
