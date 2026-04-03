import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { fetchIMFTransits } from '../api/client'

export default function TransitChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['imfTransits'],
    queryFn: () => fetchIMFTransits(90),
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-slate-500 animate-pulse">Loading transit data...</div>
  }

  const transits = data?.transits ?? []
  const summary = data?.summary

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      {summary && (
        <div className="flex gap-4 text-xs">
          {(summary.avg_daily_transits ?? summary.avg_daily_transits_30d) != null && (
            <div>
              <span className="text-slate-500">Avg daily: </span>
              <span className="text-slate-200 font-medium">{(summary.avg_daily_transits ?? summary.avg_daily_transits_30d)?.toFixed(1)}</span>
            </div>
          )}
          {summary.days_covered != null && (
            <div>
              <span className="text-slate-500">Days covered: </span>
              <span className="text-slate-200 font-medium">{summary.days_covered}</span>
            </div>
          )}
        </div>
      )}

      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={transits} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tankerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(d: string) => {
                const dt = new Date(d)
                return `${dt.getMonth() + 1}/${dt.getDate()}`
              }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: 11,
              }}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  total_transits: 'Total Transits',
                  tanker_transits: 'Tanker Transits',
                  bulk_transits: 'Bulk Transits',
                  container_transits: 'Container Transits',
                }
                return [value, labels[name] || name]
              }}
            />
            <Area
              type="monotone"
              dataKey="total_transits"
              stroke="#3b82f6"
              strokeWidth={1}
              fill="url(#totalGrad)"
            />
            <Area
              type="monotone"
              dataKey="tanker_transits"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#tankerGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
