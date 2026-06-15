/**
 * ActionCenter — client-side action toolbar for Hummus Tracker
 *
 * Actions:
 *  1. Risk Alert  — browser Notification when risk score >= threshold (localStorage persisted)
 *  2. Export JSON — snapshot bundle download
 *  3. Export CSV  — history series CSV download
 *  4. Share       — navigator.share or clipboard copy
 *  5. Install PWA — beforeinstallprompt capture + prompt()
 *  6. Daily Brief — modal showing latest intelligence brief
 *
 * 100% client-side. No backend writes. Fully defensive.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell, BellOff, Download, Share2, MonitorSmartphone, FileText,
  ChevronDown, ChevronUp, Check, AlertTriangle,
} from 'lucide-react'

import {
  fetchRiskIndex,
  fetchOverview,
  fetchHistorySeries,
  fetchLatestBrief,
} from '../api/client'

import BriefModal from './BriefModal'

// ── localStorage keys ────────────────────────────────────────────────────────
const LS_THRESHOLD = 'hummus_alert_threshold'
const LS_ENABLED   = 'hummus_alert_enabled'

// ── helpers ──────────────────────────────────────────────────────────────────
function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* no-op */ }
}

function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Types ────────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ActionCenter() {
  // ── Alert state ──────────────────────────────────────────────────────────
  const [alertExpanded, setAlertExpanded] = useState(false)
  const [threshold, setThreshold]         = useState<number>(() => parseInt(readLS(LS_THRESHOLD, '60'), 10))
  const [alertEnabled, setAlertEnabled]   = useState<boolean>(() => readLS(LS_ENABLED, 'false') === 'true')
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    notificationsSupported() ? Notification.permission : 'denied'
  )
  // Session-level debounce: only re-notify when score transitions from below→above threshold
  const wasAboveRef = useRef<boolean>(false)

  // ── PWA state ────────────────────────────────────────────────────────────
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [pwaInstalled, setPwaInstalled]   = useState(false)

  // ── Brief modal ──────────────────────────────────────────────────────────
  const [briefOpen, setBriefOpen] = useState(false)

  // ── Feedback states ──────────────────────────────────────────────────────
  const [shareMsg, setShareMsg]     = useState('')
  const [exportMsg, setExportMsg]   = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────
  const riskQuery = useQuery({
    queryKey: ['riskIndex'],
    queryFn: fetchRiskIndex,
    refetchInterval: 90_000,            // poll every 90 s
    staleTime:       60_000,
  })

  const briefQuery = useQuery({
    queryKey: ['latestBrief'],
    queryFn: fetchLatestBrief,
    staleTime: 30 * 60_000,             // 30 min — brief changes infrequently
    retry: 1,
  })

  // ── PWA install listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    // If already running as installed PWA
    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      setPwaInstalled(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // ── Risk alert effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!alertEnabled || !riskQuery.data) return
    if (!notificationsSupported() || Notification.permission !== 'granted') return

    const score   = riskQuery.data.score
    const isAbove = score >= threshold

    if (isAbove && !wasAboveRef.current) {
      // Crossed into alert zone — fire notification
      try {
        const n = new Notification('Hormuz Risk Alert', {
          body:    `Risk score ${score}/100 — ${riskQuery.data.summary}`,
          icon:    '/favicon.ico',
          tag:     'hummus-risk-alert',   // deduplicate
          silent:  false,
        })
        // Auto-close after 8 s
        setTimeout(() => n.close(), 8_000)
      } catch { /* no-op if blocked */ }
    }
    wasAboveRef.current = isAbove
  }, [riskQuery.data, alertEnabled, threshold])

  // ── Persist prefs ────────────────────────────────────────────────────────
  useEffect(() => { writeLS(LS_THRESHOLD, String(threshold)) }, [threshold])
  useEffect(() => { writeLS(LS_ENABLED,   String(alertEnabled)) }, [alertEnabled])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleAlert = useCallback(async () => {
    if (!notificationsSupported()) return

    if (!alertEnabled) {
      // Enabling — request permission first
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission().catch(() => 'denied' as const)
        setNotifPermission(perm)
        if (perm !== 'granted') return     // don't enable if denied
      } else if (Notification.permission === 'denied') {
        return                              // can't request again
      }
      setAlertEnabled(true)
    } else {
      setAlertEnabled(false)
    }
  }, [alertEnabled])

  const handleExportJSON = useCallback(async () => {
    setExportMsg('Fetching…')
    try {
      const [overview, risk, history] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchRiskIndex().catch(() => null),
        fetchHistorySeries().catch(() => null),
      ])
      const bundle = {
        exported_at: new Date().toISOString(),
        source: 'https://oil.yieldwise.my',
        overview,
        risk_index: risk,
        history,
      }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      triggerDownload(blob, `hormuz-snapshot-${todayStr()}.json`)
      setExportMsg('Downloaded!')
    } catch {
      setExportMsg('Failed')
    }
    setTimeout(() => setExportMsg(''), 2500)
  }, [])

  const handleExportCSV = useCallback(async () => {
    setExportMsg('Fetching…')
    try {
      const data = await fetchHistorySeries()
      const header = Object.keys(data.series[0] ?? {}).join(',')
      const rows   = data.series.map(row =>
        Object.values(row).map(v => (v === null || v === undefined ? '' : String(v))).join(',')
      )
      const csv  = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      triggerDownload(blob, `hormuz-history-${todayStr()}.csv`)
      setExportMsg('Downloaded!')
    } catch {
      setExportMsg('Failed')
    }
    setTimeout(() => setExportMsg(''), 2500)
  }, [])

  const handleShare = useCallback(async () => {
    const url   = 'https://oil.yieldwise.my'
    const title = 'Hummus Tracker — Strait of Hormuz Oil Risk Dashboard'
    const text  = `Real-time oil flow & geopolitical risk for the Strait of Hormuz. Risk score: ${riskQuery.data?.score ?? '—'}/100`

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        setShareMsg('Shared!')
      } catch {
        setShareMsg('')   // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setShareMsg('Copied!')
      } catch {
        setShareMsg('Failed')
      }
    }
    setTimeout(() => setShareMsg(''), 2000)
  }, [riskQuery.data])

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setPwaInstalled(true)
        setInstallPrompt(null)
      }
    } catch { /* no-op */ }
  }, [installPrompt])

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentScore   = riskQuery.data?.score ?? null
  const isAboveThresh  = currentScore !== null && currentScore >= threshold
  const notifBlocked   = notificationsSupported() && notifPermission === 'denied'
  const notifUnavail   = !notificationsSupported()
  const canInstall     = !!installPrompt && !pwaInstalled
  const riskLevel      = riskQuery.data?.level ?? 'low'
  const riskColor      = {
    low:      'text-petro-green',
    elevated: 'text-petro-gold',
    high:     'text-petro-gold',
    severe:   'text-petro-red',
  }[riskLevel] ?? 'text-text-muted'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Action bar */}
      <div className="bg-petro-card border border-petro-border rounded-xl overflow-hidden shadow-lg">
        {/* Bar header */}
        <div className="px-4 py-2.5 border-b border-petro-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-faint uppercase tracking-widest">Actions</span>
          {currentScore !== null && (
            <span className={`text-[10px] font-mono font-bold ${riskColor}`}>
              RISK {currentScore}/100
            </span>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex flex-wrap gap-px bg-petro-border">

          {/* ── 1. Risk Alert ── */}
          <div className="flex-1 min-w-0 bg-petro-card">
            <button
              onClick={() => setAlertExpanded(v => !v)}
              className={`w-full flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-petro-bg transition-colors group ${alertEnabled ? 'text-petro-teal' : 'text-text-muted'}`}
              title="Configure risk alert"
            >
              {alertEnabled
                ? <Bell size={16} className={`${isAboveThresh ? 'animate-pulse text-petro-red' : 'text-petro-teal'}`} />
                : <BellOff size={16} />
              }
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
                {alertEnabled ? (isAboveThresh ? 'ALERT!' : 'Alert on') : 'Alert'}
              </span>
            </button>

            {/* Expanded alert panel */}
            {alertExpanded && (
              <div className="border-t border-petro-border bg-petro-bg px-4 py-3 space-y-3">
                {/* Score vs threshold */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-faint uppercase tracking-wide">Current score</span>
                  <span className={`text-[11px] font-mono font-bold ${isAboveThresh ? 'text-petro-red' : riskColor}`}>
                    {currentScore !== null ? `${currentScore}` : '—'} / {threshold}
                  </span>
                </div>

                {/* Threshold slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-text-faint uppercase tracking-wide">Alert threshold</span>
                    <span className="text-[11px] font-mono font-bold text-text-warm">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={threshold}
                    onChange={e => setThreshold(parseInt(e.target.value, 10))}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer accent-petro-teal bg-petro-border"
                  />
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-text-faint">0</span>
                    <span className="text-[9px] text-text-faint">100</span>
                  </div>
                </div>

                {/* Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-faint uppercase tracking-wide">
                    {notifUnavail ? 'Browser alerts unavailable' : notifBlocked ? 'Notifications blocked' : 'Browser alerts'}
                  </span>
                  {!notifUnavail && !notifBlocked && (
                    <button
                      onClick={handleToggleAlert}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${alertEnabled ? 'bg-petro-teal' : 'bg-petro-border'}`}
                      aria-label="Toggle alerts"
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${alertEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  )}
                  {(notifUnavail || notifBlocked) && (
                    <AlertTriangle size={12} className="text-petro-gold" />
                  )}
                </div>

                {notifBlocked && (
                  <p className="text-[10px] text-petro-gold leading-relaxed">
                    Notifications are blocked. Enable them in your browser settings for this site, then try again.
                  </p>
                )}

                <button
                  onClick={() => setAlertExpanded(false)}
                  className="flex items-center gap-1 text-[10px] text-text-faint hover:text-text-muted transition-colors"
                >
                  <ChevronUp size={10} /> Close
                </button>
              </div>
            )}
            {!alertExpanded && (
              <div className="border-t border-petro-border flex justify-center pb-1">
                <button
                  onClick={() => setAlertExpanded(true)}
                  className="text-text-faint hover:text-text-muted transition-colors p-0.5"
                  title="Expand"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            )}
          </div>

          {/* ── 2. Export ── */}
          <div className="flex-1 min-w-0 bg-petro-card">
            <div className="flex flex-col items-center gap-1.5 px-3 py-3">
              <Download size={16} className="text-text-muted group-hover:text-text-warm" />
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide leading-none">Export</span>
            </div>
            <div className="border-t border-petro-border px-2 pb-2 space-y-1">
              {exportMsg ? (
                <div className="flex items-center justify-center gap-1 py-1">
                  <Check size={11} className="text-petro-green" />
                  <span className="text-[10px] text-petro-green font-bold">{exportMsg}</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleExportJSON}
                    className="w-full text-[10px] font-bold text-text-faint hover:text-text-warm hover:bg-petro-bg border border-petro-border rounded px-2 py-1 uppercase tracking-wide transition-colors"
                  >
                    JSON snapshot
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full text-[10px] font-bold text-text-faint hover:text-text-warm hover:bg-petro-bg border border-petro-border rounded px-2 py-1 uppercase tracking-wide transition-colors"
                  >
                    CSV history
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── 3. Share ── */}
          <div className="flex-1 min-w-0 bg-petro-card">
            <button
              onClick={handleShare}
              className="w-full flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-petro-bg transition-colors text-text-muted hover:text-text-warm"
              title="Share dashboard"
            >
              {shareMsg
                ? <Check size={16} className="text-petro-green" />
                : <Share2 size={16} />
              }
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none">
                {shareMsg || 'Share'}
              </span>
            </button>
          </div>

          {/* ── 4. Install PWA ── (hidden unless prompt available) */}
          {canInstall && (
            <div className="flex-1 min-w-0 bg-petro-card">
              <button
                onClick={handleInstall}
                className="w-full flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-petro-bg transition-colors text-text-muted hover:text-petro-teal"
                title="Install as app"
              >
                <MonitorSmartphone size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wide leading-none">Install</span>
              </button>
            </div>
          )}

          {/* ── 5. Daily Brief ── */}
          <div className="flex-1 min-w-0 bg-petro-card">
            <button
              onClick={() => setBriefOpen(true)}
              className="w-full flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-petro-bg transition-colors text-text-muted hover:text-petro-teal"
              title="View latest intelligence brief"
            >
              <FileText size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none">Brief</span>
            </button>
          </div>

        </div>

        {/* Alert status strip */}
        {alertEnabled && currentScore !== null && (
          <div className={`px-4 py-1.5 flex items-center justify-between border-t border-petro-border ${isAboveThresh ? 'bg-petro-red/10' : 'bg-petro-bg'}`}>
            <span className="text-[10px] text-text-faint uppercase tracking-wide">Risk alert active</span>
            <span className={`text-[10px] font-mono font-bold ${isAboveThresh ? 'text-petro-red animate-pulse' : 'text-petro-green'}`}>
              {isAboveThresh ? `TRIGGERED (${currentScore} ≥ ${threshold})` : `Watching (${currentScore} < ${threshold})`}
            </span>
          </div>
        )}
      </div>

      {/* Brief modal */}
      <BriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        brief={briefQuery.data ?? null}
        isLoading={briefQuery.isLoading}
      />
    </>
  )
}
