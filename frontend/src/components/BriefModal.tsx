import { useEffect, useState } from 'react'
import { X, FileText, Copy, Check, Share2 } from 'lucide-react'
import type { IntelligenceBrief } from '../api/client'

interface BriefModalProps {
  open: boolean
  onClose: () => void
  brief: IntelligenceBrief | null | undefined
  isLoading?: boolean
}

export default function BriefModal({ open, onClose, brief, isLoading }: BriefModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleCopy = async () => {
    if (!brief?.content_markdown) return
    try {
      await navigator.clipboard.writeText(brief.content_markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  const handleShare = async () => {
    if (navigator.share && brief) {
      try {
        await navigator.share({
          title: `Hormuz Intelligence Brief — ${brief.date}`,
          text: brief.content_markdown.slice(0, 300) + '…',
          url: 'https://oil.yieldwise.my',
        })
        return
      } catch {
        // user cancelled or share failed, fall through to copy
      }
    }
    handleCopy()
  }

  // Render markdown-ish content as readable paragraphs without a full MD parser
  const renderContent = (md: string) => {
    return md.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-xs font-bold text-petro-teal uppercase tracking-widest mt-4 mb-1">{line.slice(3)}</h3>
      }
      if (line.startsWith('# ')) {
        return <h2 key={i} className="text-sm font-bold text-text-warm uppercase tracking-wide mt-2 mb-2">{line.slice(2)}</h2>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="text-xs text-text-faint leading-relaxed ml-4 list-disc">{line.slice(2)}</li>
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="text-xs font-bold text-text-warm mt-2">{line.slice(2, -2)}</p>
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />
      }
      return <p key={i} className="text-xs text-text-faint leading-relaxed">{line}</p>
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-petro-card border border-petro-border rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-petro-card border-b border-petro-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-petro-teal" />
            <h2 className="text-sm font-bold text-text-warm uppercase tracking-widest">Intelligence Brief</h2>
            {brief?.date && (
              <span className="text-[10px] font-mono text-text-faint bg-petro-bg border border-petro-border rounded px-2 py-0.5">
                {brief.date}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              title="Share brief"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide border border-petro-border text-text-muted hover:text-text-warm hover:border-petro-teal/50 transition-colors"
            >
              <Share2 size={12} />
              Share
            </button>
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold uppercase tracking-wide border border-petro-border text-text-muted hover:text-text-warm hover:border-petro-teal/50 transition-colors"
            >
              {copied ? <Check size={12} className="text-petro-green" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-petro-border text-text-muted hover:text-text-warm transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {isLoading && (
            <p className="text-xs text-text-faint animate-pulse">Loading intelligence brief…</p>
          )}
          {!isLoading && !brief && (
            <p className="text-xs text-text-faint">No brief available for today.</p>
          )}
          {!isLoading && brief && (
            <div className="space-y-0.5">
              {renderContent(brief.content_markdown)}
            </div>
          )}
          {brief?.created_at && (
            <p className="text-[10px] text-text-faint mt-6 font-mono border-t border-petro-border pt-3">
              Generated: {new Date(brief.created_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
