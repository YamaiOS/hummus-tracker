import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Clock, Coins, Globe, TrendingUp } from 'lucide-react'
import { fetchImpact } from '../api/client'

export default function SupplyChainImpact() {
  const { data, isLoading } = useQuery({
    queryKey: ['impact'],
    queryFn: fetchImpact,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div className="h-48 bg-slate-800/20 animate-pulse rounded-lg" />
  }

  const bypass = data?.bypass_analysis

  return (
    <div className="space-y-6">
      {/* Insurance Multiplier */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldAlert size={60} />
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">War Risk Insurance</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-amber-500">{data?.war_risk_multiplier}x</h3>
          <span className="text-xs text-slate-400 font-medium italic">Premium Multiplier</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
            data?.insurance_status === 'CRITICAL' ? 'bg-red-900 text-red-200' :
            data?.insurance_status === 'HIGH' ? 'bg-amber-900 text-amber-200' : 'bg-emerald-900 text-emerald-200'
          }`}>
            STATUS: {data?.insurance_status}
          </span>
          <p className="text-[10px] text-slate-500">Relative to baseline 2024 premiums</p>
        </div>
      </div>

      {/* Alternative Route Analysis */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Globe size={12} /> Bypass Analysis: {bypass?.route}
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1 text-slate-500">
              <Clock size={14} />
              <span className="text-[10px] uppercase font-bold">Transit Time</span>
            </div>
            <p className="text-lg font-bold text-slate-200">+{bypass?.extra_days} Days</p>
            <p className="text-[10px] text-slate-600">via Southern Tip</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1 text-slate-500">
              <Coins size={14} />
              <span className="text-[10px] uppercase font-bold">Extra OpEx</span>
            </div>
            <p className="text-lg font-bold text-emerald-500">${(bypass?.extra_cost_per_vlcc_usd ? bypass.extra_cost_per_vlcc_usd / 1000 : 0)}k</p>
            <p className="text-[10px] text-slate-600">Per VLCC transit</p>
          </div>
        </div>
      </div>

      {/* Daily Economic Friction */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Est. Daily Friction Loss</p>
            <p className="text-xl font-mono font-bold text-slate-300">
              ${(data?.global_economic_loss_est_usd_day ? data.global_economic_loss_est_usd_day / 1_000_000_000 : 0).toFixed(2)}B
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-600 leading-tight italic">
              Global economic drag<br/>due to Hormuz bottleneck
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
