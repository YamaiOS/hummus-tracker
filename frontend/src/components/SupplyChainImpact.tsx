import { useQuery } from '@tanstack/react-query'
import { fetchImpact, fetchInsurance } from '../api/client'

export default function SupplyChainImpact() {
  const { data, isLoading } = useQuery({
    queryKey: ['impact'],
    queryFn: fetchImpact,
    refetchInterval: 60_000,
  })

  const { data: insurance } = useQuery({
    queryKey: ['insurance'],
    queryFn: fetchInsurance,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading Impact...</span>
      </div>
    )
  }

  const bypass = data?.bypass_analysis

  return (
    <div className="space-y-6">
      {/* Insurance Multiplier */}
      <div className="bg-petro-bg border border-petro-border rounded-lg p-4 relative overflow-hidden">
        <div className="flex justify-between items-start mb-1">
          <p className="text-[11px] text-text-muted uppercase font-bold tracking-wide">WAR RISK INSURANCE</p>
          {insurance?.jwc_status && (
            <span className="text-[11px] font-mono font-bold text-petro-gold uppercase">
              {insurance.jwc_status}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-petro-gold font-mono">
            {(insurance?.multiplier || data?.war_risk_multiplier || 1).toFixed(1)}x
          </h3>
          <span className="text-[11px] text-text-faint font-bold uppercase">Multiplier</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono font-bold ${
              insurance ? (insurance.multiplier > 5 ? 'text-petro-red' : 'text-petro-gold') : 'text-text-muted'
            }`}>
              {insurance?.premium_bps ? `${insurance.premium_bps} BPS` : '—'}
            </span>
            <p className="text-[11px] text-text-faint uppercase font-bold tracking-tighter">Current Premium</p>
          </div>
          {insurance?.is_listed_area && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-petro-red uppercase tracking-tight">
              <div className="w-1.5 h-1.5 rounded-full bg-petro-red" />
              JWC LISTED
            </div>
          )}
        </div>
      </div>

      {/* Alternative Route Analysis */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
          BYPASS ANALYSIS: {bypass?.route}
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-petro-bg border border-petro-border rounded p-3">
            <p className="text-xs uppercase font-bold text-text-faint mb-1">Transit Time</p>
            <p className="text-lg font-mono font-bold text-text-warm">+{bypass?.extra_days} DAYS</p>
          </div>

          <div className="bg-petro-bg border border-petro-border rounded p-3">
            <p className="text-xs uppercase font-bold text-text-faint mb-1">Extra OpEx</p>
            <p className="text-lg font-mono font-bold text-petro-teal">
              ${(bypass?.extra_cost_per_vlcc_usd ? bypass.extra_cost_per_vlcc_usd / 1000 : 0)}K
            </p>
          </div>
        </div>
      </div>

      {/* Daily Economic Friction */}
      <div className="pt-4 border-t border-petro-border">
        <p className="text-xs text-text-muted uppercase font-bold mb-1">Daily Global Friction Loss</p>
        <p className="text-2xl font-mono font-bold text-text-warm">
          ${(data?.global_economic_loss_est_usd_day ? data.global_economic_loss_est_usd_day / 1_000_000_000 : 0).toFixed(2)}B
        </p>
      </div>
    </div>
  )
}
