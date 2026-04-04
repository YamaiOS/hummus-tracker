import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchFujairahHistory } from '../api/client'

export default function FujairahInventoryPanel() {
  const { data: history, isLoading } = useQuery({
    queryKey: ['fujairahHistory'],
    queryFn: () => fetchFujairahHistory(12),
    refetchInterval: 3600_000,
  })

  if (isLoading && !history) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading Inventory...</span>
      </div>
    )
  }

  const chartData = [...(history || [])].reverse().map(item => ({
    date: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    light: item.light_distillates,
    middle: item.middle_distillates,
    heavy: item.heavy_distillates_residues,
  }))

  const latest = history?.[0]

  return (
    <div className="space-y-4">
      {latest && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">LIGHT</p>
            <p className="text-sm font-mono font-bold text-text-warm">{(latest.light_distillates / 1000).toFixed(1)}M</p>
          </div>
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">MIDDLE</p>
            <p className="text-sm font-mono font-bold text-text-warm">{(latest.middle_distillates / 1000).toFixed(1)}M</p>
          </div>
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">HEAVY</p>
            <p className="text-sm font-mono font-bold text-text-warm">{(latest.heavy_distillates_residues / 1000).toFixed(1)}M</p>
          </div>
        </div>
      )}

      <div className="h-48 w-full bg-petro-bg/30 rounded-md p-2 border border-petro-border">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#566b8a" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="#566b8a" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              itemStyle={{ fontSize: '11px' }}
            />
            <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} />
            <Bar dataKey="light" name="LIGHT" stackId="a" fill="#00a19c" />
            <Bar dataKey="middle" name="MIDDLE" stackId="a" fill="#c4a35a" />
            <Bar dataKey="heavy" name="HEAVY" stackId="a" fill="#8b9bb4" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
