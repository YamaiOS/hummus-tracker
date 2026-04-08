import { useQuery } from '@tanstack/react-query'
import { fetchLatestBrief } from '../api/client'

export default function IntelligenceBriefPanel() {
  const { data: brief, isLoading } = useQuery({
    queryKey: ['latestBrief'],
    queryFn: fetchLatestBrief,
    refetchInterval: 3600_000,
  })

  if (isLoading && !brief) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Generating Brief...</span>
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No brief available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <span className="text-[11px] font-bold text-text-faint uppercase tracking-wide">DATE: {brief.date}</span>
      </div>

      <div className="p-4 bg-petro-bg border border-petro-border rounded">
        <BriefMarkdown content={brief.content_markdown} />
      </div>
    </div>
  )
}

// Minimal markdown renderer for the daily brief format.
// Supports: # / ## / ### headings, **bold**, > blockquotes, - lists, paragraphs.
function BriefMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuffer: string[] = []
  let paraBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1 my-2 text-sm text-text-warm">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  const flushPara = () => {
    if (paraBuffer.length === 0) return
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm text-text-warm leading-relaxed my-2" style={{ overflowWrap: 'break-word' }}>
        {renderInline(paraBuffer.join(' '))}
      </p>
    )
    paraBuffer = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushList()
      flushPara()
      continue
    }
    if (line.startsWith('### ')) {
      flushList(); flushPara()
      blocks.push(<h4 key={`h4-${blocks.length}`} className="text-xs font-bold uppercase tracking-wide text-text-muted mt-3 mb-1">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      flushList(); flushPara()
      blocks.push(<h3 key={`h3-${blocks.length}`} className="text-sm font-bold uppercase tracking-wide text-petro-teal mt-4 mb-1">{renderInline(line.slice(3))}</h3>)
    } else if (line.startsWith('# ')) {
      flushList(); flushPara()
      blocks.push(<h2 key={`h2-${blocks.length}`} className="text-base font-bold uppercase tracking-wide text-text-warm mt-2 mb-2">{renderInline(line.slice(2))}</h2>)
    } else if (line.startsWith('> ')) {
      flushList(); flushPara()
      blocks.push(
        <blockquote key={`bq-${blocks.length}`} className="border-l-2 border-petro-gold pl-3 my-2 text-sm text-text-muted italic" style={{ overflowWrap: 'break-word' }}>
          {renderInline(line.slice(2))}
        </blockquote>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushPara()
      listBuffer.push(line.slice(2))
    } else {
      flushList()
      paraBuffer.push(line)
    }
  }
  flushList()
  flushPara()

  return <div className="space-y-1">{blocks}</div>
}

// Inline parser: **bold** only (sufficient for the brief's structure)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(<strong key={i++} className="font-bold text-text-warm">{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}
