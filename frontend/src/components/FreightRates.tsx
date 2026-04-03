import { useQuery } from '@tanstack/react-query'
import { Gauge, TrendingUp, Anchor, AlertCircle } from 'lucide-react'
import { fetchFreight } from '../api/client'

export default function FreightRates() {
  const { data, isLoading } = useQuery({
    queryKey: ['freight'],
    queryFn: fetchFreight,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div className="h-48 bg-slate-800/20 animate-pulse rounded-lg" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            data?.market_sentiment === 'BULLISH' ? 'bg-red-900 text-red-200' : 'bg-slate-800 text-slate-400'
          }`}>
            SENTIMENT: {data?.market_sentiment}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Risk Premium</p>
          <p className="text-xs font-bold text-amber-500">+{((data?.risk_multiplier || 1) - 1).toFixed(2)}x</p>
        </div>
      </div>

      <div className="space-y-3">
        {data?.estimates.map((est, i) => (
          <div key={i} className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-xs font-black text-slate-200">{est.class}</h4>
                <p className="text-[9px] text-slate-500 font-medium uppercase">{est.route}</p>
              </div>
              <div className={`flex items-center gap-1 text-[9px] font-bold ${
                est.status === 'RISING' ? 'text-red-400' : 'text-slate-500'
              }`}>
                {est.status === 'RISING' && <TrendingUp size={10} />}
                {est.status}
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <p className="text-[9px] text-slate-500 uppercase font-bold">Worldscale (WS)</p>
                <p className="text-lg font-mono font-bold text-amber-500">{est.ws_points}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[9px] text-slate-500 uppercase font-bold">Est. Day Rate (TCE)</p>
                <p className="text-lg font-mono font-bold text-emerald-500">
                  ${(est.tce_day_rate_usd / 1000).toFixed(1)}k<span className="text-[10px] text-slate-600 ml-0.5">/day</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-2 bg-blue-950/20 border border-blue-900/30 rounded-lg flex gap-2 items-start">
        <AlertCircle size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-[9px] text-blue-300/70 leading-relaxed italic">
          Heuristic Freight Model: Estimates derived from Brent spot volatility, VLSFO fuel adjustment, and War Risk premiums associated with Strait of Hormuz chokepoint activity.
        </p>
      </div>
    </div>
  )
}
