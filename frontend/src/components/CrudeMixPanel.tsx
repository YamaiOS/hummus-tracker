import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { fetchLiveVessels } from '../api/client'

const COLORS = ['#c4a35a', '#00a19c', '#8b9bb4', '#c4463a', '#2d8a6e', '#566b8a']

export default function CrudeMixPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveVessels'],
    queryFn: fetchLiveVessels,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const vessels = data?.vessels ?? []

  const gradeMap: Record<string, number> = {}
  let totalBarrels = 0

  vessels.forEach(v => {
    if (v.is_loaded && v.direction === 'outbound' && v.crude_grade) {
      const grade = v.crude_grade
      const barrels = v.estimated_barrels ?? 0
      gradeMap[grade] = (gradeMap[grade] || 0) + barrels
      totalBarrels += barrels
    }
  })

  const chartData = Object.entries(gradeMap).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value)

  if (chartData.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-text-faint">No grade intelligence from current outbound flow</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              formatter={(val: number) => [`${(val / 1_000_000).toFixed(2)}M bbl`, 'Estimated Cargo']}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {chartData.slice(0, 4).map((item, idx) => (
          <div key={item.name} className="p-2 bg-petro-bg border border-petro-border rounded">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <span className="text-xs font-bold text-text-muted truncate uppercase">{item.name}</span>
            </div>
            <p className="text-sm font-mono font-bold text-text-warm">
              {((item.value / totalBarrels) * 100).toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
