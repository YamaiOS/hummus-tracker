import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { fetchMarketMetrics, fetchEFSHistory } from '../api/client'

export default function MarketMetricsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketMetrics'],
    queryFn: fetchMarketMetrics,
    refetchInterval: 300_000,
  })

  const { data: historyData } = useQuery({
    queryKey: ['efsHistory'],
    queryFn: () => fetchEFSHistory(90),
  })

  if (isLoading && !data) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Loading Market Data...</span>
      </div>
    )
  }

  const metrics = data?.metrics
  if (!metrics) return null

  const curveData = [
    { name: 'M1', brent: metrics.brent_m1, dubai: metrics.dubai_m1 },
    { name: 'M2', brent: metrics.brent_m2, dubai: metrics.dubai_m2 },
    { name: 'M6', brent: metrics.brent_m6, dubai: metrics.dubai_m6 },
  ]

  const brentStructure = metrics.brent_m1_m2 > 0 ? 'BACKWARDATION' : 'CONTANGO'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-8 px-1">
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">BRENT-DUBAI (EFS)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-text-warm">${metrics.brent_dubai_efs.toFixed(2)}</span>
            <span className="text-xs text-text-faint font-bold uppercase">USD/BBL</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">M1-M6 SPREAD</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-mono font-bold text-text-warm">${metrics.brent_m1_m6.toFixed(2)}</span>
            <span className={`text-[11px] font-bold uppercase tracking-tight ${metrics.brent_m1_m2 > 0 ? 'text-petro-teal' : 'text-petro-gold'}`}>
              {brentStructure}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1">Forward Curve Structure</p>
        <div className="h-48 w-full bg-petro-bg/30 rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis dataKey="name" stroke="#566b8a" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#566b8a" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
                itemStyle={{ fontSize: '11px' }}
              />
              <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} />
              <Line type="monotone" dataKey="brent" name="BRENT" stroke="#00a19c" strokeWidth={2} dot={{ r: 3, fill: '#00a19c' }} />
              <Line type="monotone" dataKey="dubai" name="DUBAI" stroke="#c4a35a" strokeWidth={2} dot={{ r: 3, fill: '#c4a35a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1">90-Day EFS Time-Series</p>
        <div className="h-32 w-full bg-petro-bg/30 rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData?.history || []} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEfs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a19c" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00a19c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis stroke="#566b8a" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
                itemStyle={{ fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="efs" stroke="#00a19c" fillOpacity={1} fill="url(#colorEfs)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
