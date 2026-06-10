import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import type { SessionItem } from '../types'

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const THRESH = 72

function SwipeableItem({ si, onToggleBought, onUpdateQuantity }: {
  si: SessionItem
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const isSwiping = Math.abs(swipeX) > 4

  const handlers = useSwipeable({
    onSwiping: ({ deltaX, absX, absY }) => {
      if (absX > absY) setSwipeX(deltaX)
    },
    onSwipedRight: ({ deltaX }) => {
      if (deltaX > THRESH && !si.bought) onToggleBought(si.id)
      setSwipeX(0)
    },
    onSwipedLeft: ({ deltaX }) => {
      if (Math.abs(deltaX) > THRESH && si.bought) onToggleBought(si.id)
      setSwipeX(0)
    },
    onSwiped: () => setSwipeX(0),
    trackMouse: false,
    delta: 8,
  })

  const clamp = Math.max(-THRESH, Math.min(THRESH, swipeX))
  const progress = Math.abs(clamp) / THRESH
  const isRight = clamp > 0

  return (
    <div
      {...handlers}
      className={`item${si.bought ? ' done' : ''}`}
      onClick={() => onToggleBought(si.id)}
      style={{
        position: `relative`,
        overflow: `hidden`,
        transform: isSwiping ? `translateX(${clamp * 0.3}px)` : undefined,
        transition: isSwiping ? `none` : `transform 0.25s ease`,
      }}
    >
      {isSwiping && (
        <div className="swipe-bg" style={{
          background: isRight
            ? `rgba(47,209,122,${progress * 0.45})`
            : `rgba(155,155,170,${progress * 0.4})`,
        }} />
      )}
      <div className={`check on${si.bought ? ` bought` : ``}`}>{CHECK}</div>
      <span className="item-name">{si.name}</span>
      <div className="qty-stepper" onClick={e => e.stopPropagation()}>
        <button
          className="qty-btn"
          onMouseDown={e => e.preventDefault()}
          onClick={() => onUpdateQuantity(si.id, Math.max(1, si.quantity - 1))}
        >−</button>
        <span className="qty-val">{si.quantity}</span>
        <button
          className="qty-btn"
          onMouseDown={e => e.preventDefault()}
          onClick={() => onUpdateQuantity(si.id, si.quantity + 1)}
        >+</button>
      </div>
    </div>
  )
}

interface Props {
  sessionItems: SessionItem[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
  onAddSessionItem: (name: string, sectionName: string) => void
}

export default function ShoppingSession({ sessionItems, onToggleBought, onUpdateQuantity, onAddSessionItem }: Props) {
  const [addName, setAddName] = useState(``)
  const [addSection, setAddSection] = useState(``)
  const [showAdd, setShowAdd] = useState(false)

  if (sessionItems.length === 0) {
    return (
      <div className="empty">
        Nessun articolo selezionato.<br />
        Vai su <b>Lista base</b> e tocca gli alimenti<br />
        che vuoi comprare questa volta.
      </div>
    )
  }

  const boughtCount = sessionItems.filter(si => si.bought).length
  const pct = Math.round((boughtCount / sessionItems.length) * 100)

  const groups: Record<string, SessionItem[]> = {}
  for (const si of sessionItems) {
    if (!groups[si.section_name]) groups[si.section_name] = []
    groups[si.section_name].push(si)
  }

  const uniqueSections = Object.keys(groups)

  function handleAdd() {
    const name = addName.trim()
    if (!name) return
    const section = addSection || uniqueSections[0] || `Altro`
    onAddSessionItem(name, section)
    setAddName(``)
    setShowAdd(false)
  }

  return (
    <div>
      <div className={`progress${pct === 100 ? ` complete` : ``}`}>
        <span style={{ width: `${pct}%` }} />
      </div>

      {Object.entries(groups).map(([sectionName, groupItems]) => (
        <div key={sectionName} className="section">
          <div className="section-head" style={{ cursor: `default` }}>
            {sectionName}
          </div>
          <div className="section-body" style={{ padding: `4px 14px 10px` }}>
            {groupItems.map(si => (
              <SwipeableItem
                key={si.id}
                si={si}
                onToggleBought={onToggleBought}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="session-add">
        {showAdd ? (
          <div className="session-add-form">
            <input
              placeholder={`Nome articolo…`}
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => { if (e.key === `Enter`) handleAdd() }}
              autoFocus
            />
            <select
              value={addSection}
              onChange={e => setAddSection(e.target.value)}
            >
              {uniqueSections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
              {!uniqueSections.includes(`Altro`) && (
                <option value="Altro">Altro</option>
              )}
            </select>
            <button onClick={handleAdd}>+</button>
            <button className="btn-cancel-sm" onClick={() => { setShowAdd(false); setAddName(``) }}>✕</button>
          </div>
        ) : (
          <button
            className="session-add-btn"
            onClick={() => { setShowAdd(true); setAddSection(uniqueSections[0] || `Altro`) }}
          >
            + Aggiungi articolo
          </button>
        )}
      </div>
    </div>
  )
}
