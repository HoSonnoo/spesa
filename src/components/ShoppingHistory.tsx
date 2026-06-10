import { useState } from 'react'
import type { ShoppingSession, SessionItem } from '../types'

interface Props {
  sessions: ShoppingSession[]
  sessionItems: Record<string, SessionItem[]>
  loading: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return `—`
  return new Date(iso).toLocaleDateString(`it-IT`, {
    weekday: `long`,
    day: `numeric`,
    month: `long`,
    year: `numeric`,
  })
}

export default function ShoppingHistory({ sessions, sessionItems, loading }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <div className="empty">Caricamento cronologia…</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="empty">
        Nessuna spesa completata.<br />
        Le sessioni completate appariranno qui.
      </div>
    )
  }

  return (
    <div className="history-list">
      {sessions.map(session => {
        const items = sessionItems[session.id] ?? []
        const bought = items.filter(i => i.bought).length
        const total = items.length
        const pct = total > 0 ? Math.round((bought / total) * 100) : 0
        const isOpen = expanded.has(session.id)

        const groups: Record<string, SessionItem[]> = {}
        for (const si of items) {
          if (!groups[si.section_name]) groups[si.section_name] = []
          groups[si.section_name].push(si)
        }

        return (
          <div key={session.id} className={`history-card${isOpen ? ' open' : ''}`}>
            <button className="history-head" onClick={() => toggle(session.id)}>
              <div className="history-meta">
                <span className="history-date">{formatDate(session.completed_at)}</span>
                <div className="history-stats">
                  <span className="history-badge history-badge--bought">{bought}/{total} comprati</span>
                  <span className={`history-badge history-badge--pct${pct === 100 ? ' full' : ''}`}>{pct}%</span>
                </div>
              </div>
              <span className={`chev${isOpen ? ' open' : ''}`}>▼</span>
            </button>

            {isOpen && (
              <div className="history-body">
                {total === 0 ? (
                  <p className="history-empty">Nessun articolo registrato.</p>
                ) : (
                  Object.entries(groups).map(([sectionName, groupItems]) => (
                    <div key={sectionName} className="history-group">
                      <div className="history-group-name">{sectionName}</div>
                      {groupItems.map(si => (
                        <div key={si.id} className={`history-item${si.bought ? ' bought' : ' missed'}`}>
                          <span className="history-item-dot">{si.bought ? `✓` : `✗`}</span>
                          <span className="history-item-name">
                            {si.name}
                            {si.quantity > 1 && <span className="qty-badge">×{si.quantity}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
