import { FlaskConical, ShieldCheck, Eye, Ban } from 'lucide-react'

// Verdict chip color mapping
type Verdict = 'NULL' | 'KILL' | 'NOT ROBUST'

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; border: string }> = {
  NULL: {
    bg: 'bg-petro-gold/15',
    text: 'text-petro-gold',
    border: 'border border-petro-gold/40',
  },
  KILL: {
    bg: 'bg-petro-red/15',
    text: 'text-petro-red',
    border: 'border border-petro-red/40',
  },
  'NOT ROBUST': {
    bg: 'bg-[#f97316]/15',
    text: 'text-[#f97316]',
    border: 'border border-[#f97316]/40',
  },
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const s = VERDICT_STYLE[verdict]
  return (
    <span
      className={`inline-block text-[9px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap uppercase tracking-wider ${s.bg} ${s.text} ${s.border}`}
    >
      {verdict}
    </span>
  )
}

const TESTS: {
  num: string
  label: string
  detail: string
  result: string
  verdict: Verdict
}[] = [
  {
    num: '1',
    label: 'Lead-lag',
    detail: 'Risk index → Brent monthly returns (n=125)',
    result: 'Peak r=−0.15, inside 95% CI',
    verdict: 'NULL',
  },
  {
    num: 'H1',
    label: 'Volatility edge',
    detail: 'Signal → forward realized vol, beyond OVX+HAR',
    result: 'Walk-forward OOS R² Δ negative at all horizons',
    verdict: 'KILL',
  },
  {
    num: 'H8',
    label: 'Tail probability',
    detail: 'Signal → P(Brent |r|>2σ) in top-decile windows',
    result: 'Naive 1.33× lift collapses to block-bootstrap p=0.46',
    verdict: 'NOT ROBUST',
  },
  {
    num: 'H3',
    label: 'Equity event study',
    detail: 'Hormuz shock → energy/shipping equity L/S (n=8 events)',
    result: 'No significant abnormal return; signs against thesis',
    verdict: 'KILL',
  },
]

const MONITORING_STRENGTHS = [
  'Real-time multi-source risk monitoring (AIS, news, sanctions, GPR)',
  'Transparent risk synthesis — 8-component index with explicit data tiers',
  'Situational awareness and event timeline across documented incidents',
  'Honest signal interpretation: what moved, how much, how fast it reverted',
]

export default function ResearchHonesty() {
  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="space-y-2">
        <p className="text-sm text-text-muted leading-relaxed">
          We tested whether this dashboard's risk signal can{' '}
          <span className="text-text-warm font-semibold">predict</span> oil markets. We ran four
          independent, rigorous tests. The honest answer:{' '}
          <span className="text-petro-gold font-semibold">it can't</span> — and that's the point.
          Markets price geopolitical risk within hours (Brent +2.6% on event day, then fully reverts
          within a week). This is a{' '}
          <span className="text-petro-teal font-semibold">monitoring &amp; situational-awareness</span>{' '}
          tool, not a trading signal.
        </p>
      </div>

      {/* Results table */}
      <div>
        <h3 className="text-[11px] font-bold text-text-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <FlaskConical size={11} className="text-petro-gold" />
          Four Independent Tests — One Consistent Answer
        </h3>
        <div className="border border-petro-border rounded overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-petro-bg/40 text-text-faint uppercase font-mono">
                <th className="text-left px-2.5 py-1.5 font-medium w-8">#</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Test</th>
                <th className="text-left px-2.5 py-1.5 font-medium hidden sm:table-cell">Key result</th>
                <th className="text-right px-2.5 py-1.5 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {TESTS.map((t) => (
                <tr key={t.num} className="border-t border-petro-border/60">
                  <td className="px-2.5 py-2 font-mono text-text-faint align-top">{t.num}</td>
                  <td className="px-2.5 py-2 align-top">
                    <span className="font-semibold text-text-warm">{t.label}</span>
                    <br />
                    <span className="text-[10px] text-text-faint leading-snug">{t.detail}</span>
                  </td>
                  <td className="px-2.5 py-2 text-text-muted leading-snug hidden sm:table-cell align-top max-w-[220px]">
                    {t.result}
                  </td>
                  <td className="px-2.5 py-2 text-right align-top">
                    <VerdictChip verdict={t.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Why we publish this */}
      <div className="bg-petro-bg/40 border border-petro-border rounded p-3 space-y-1">
        <h3 className="text-[11px] font-bold text-text-faint uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck size={11} className="text-petro-teal" />
          Why We Publish This
        </h3>
        <p className="text-[12px] text-text-muted leading-relaxed">
          Each test used out-of-sample walk-forward evaluation, Newey-West HAC standard errors
          (heteroskedasticity &amp; autocorrelation consistent), placebo controls, and 60-day block
          bootstrap to handle regime clustering in tail events. Finding the null cheaply — before
          risking capital — is the evidence-first win. Publishing it is the moat: nearly no
          competing geopolitical dashboard tests its own signal, let alone discloses the result.
        </p>
      </div>

      {/* What the tool IS good for */}
      <div>
        <h3 className="text-[11px] font-bold text-text-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Eye size={11} className="text-petro-teal" />
          What This Tool Is Good For
        </h3>
        <ul className="space-y-1.5">
          {MONITORING_STRENGTHS.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-text-muted leading-snug">
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-petro-teal/70 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] text-text-faint flex items-center gap-1.5">
          <Ban size={10} className="text-petro-red/70 flex-shrink-0" />
          NOT for price prediction, alpha generation, or trading signals.
        </p>
      </div>

      {/* Methodology footnote */}
      <p className="text-[10px] font-mono text-text-faint border-t border-petro-border pt-2 leading-relaxed">
        Full reproducible findings:{' '}
        <span className="text-petro-gold/70">docs/research/phase1-edge-findings.md</span>
        {' · '}
        <span className="text-petro-gold/70">docs/research/phase2-equity-eventstudy.md</span>
        {' · '}
        Repro: <span className="italic">python3 research/phase1_vol_edge.py</span> &amp;{' '}
        <span className="italic">python3 research/phase2_equity_eventstudy.py</span>
      </p>
    </div>
  )
}
