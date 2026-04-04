import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fetchPortCongestion } from '../api/client'

export default function PortCongestionPanel() {
  const { data: congestion, isLoading } = useQuery({
    queryKey: ['portCongestion'],
    queryFn: fetchPortCongestion,
    refetchInterval: 1800_000,
  })

  if (isLoading && !congestion) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Calculating...</span>
      </div>
    )
  }

  const sortedData = [...(congestion || [])].sort((a, b) => b.avg_wait_hrs - a.avg_wait_hrs)

  const getStatusColor = (hrs: number) => {
    if (hrs > 48) return '#c4463a' // petro-red
    if (hrs > 36) return '#c4a35a' // petro-gold
    return '#00a19c' // petro-teal
  }

  return (
    <div className="space-y-4">
      <div className="h-64 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={sortedData} 
            layout="vertical" 
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" horizontal={true} vertical={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="terminal_name" 
              type="category" 
              stroke="#566b8a" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false}
              width={100}
              tick={{ fill: '#8b9bb4', fontWeight: 'bold' }}
            />
            <Tooltip 
              cursor={{ fill: '#142540', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              itemStyle={{ color: '#e8e4df' }}
              formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'AVG WAIT']}
            />
            <Bar dataKey="avg_wait_hrs" radius={[0, 2, 2, 0]} barSize={16}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.avg_wait_hrs)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
