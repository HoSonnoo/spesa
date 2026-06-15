import { useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import type { SessionItem, Section, Subsection } from '../types'

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
            ? `rgba(var(--primary-rgb),${progress * 0.45})`
            : `rgba(155,155,170,${progress * 0.4})`,
        }} />
      )}
      <div className={`check${si.bought ? ` on` : ``}`}>{CHECK}</div>
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
  sections: Section[]
  subsections: Subsection[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, quantity: number) => void
  onAddSessionItem: (name: string, sectionName: string, subsectionId?: string) => void
}

export default function ShoppingSession({
  sessionItems,
  sections,
  subsections,
  onToggleBought,
  onUpdateQuantity,
  onAddSessionItem,
}: Props) {
  const [addName, setAddName] = useState(``)
  const [showAdd, setShowAdd] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [pendingName, setPendingName] = useState(``)
  const [modalSectionId, setModalSectionId] = useState<string | null>(null)
  const [modalSubsectionId, setModalSubsectionId] = useState<string | null>(null)

  const sortedSections = [...sections].sort((a, b) => a.position - b.position)

  const selectedSectionSubs = modalSectionId
    ? [...subsections]
        .filter(s => s.section_id === modalSectionId)
        .sort((a, b) => a.position - b.position)
    : []
  const namedSubs = selectedSectionSubs.filter(s => s.name !== ``)
  const needsSubsection = namedSubs.length > 0
  const canConfirm = !!modalSectionId && (!needsSubsection || !!modalSubsectionId)

  function handleOpenAdd() {
    setShowAdd(true)
  }

  function handleCancelAdd() {
    setShowAdd(false)
    setAddName(``)
  }

  function handleAdd() {
    const name = addName.trim()
    if (!name) return
    if (sections.length === 0) {
      onAddSessionItem(name, `Altro`)
      setAddName(``)
      setShowAdd(false)
      return
    }
    setPendingName(name)
    setModalSectionId(null)
    setModalSubsectionId(null)
    setShowModal(true)
  }

  function handleSelectSection(id: string) {
    setModalSectionId(id)
    setModalSubsectionId(null)
  }

  function handleModalConfirm() {
    if (!modalSectionId) return
    const section = sortedSections.find(s => s.id === modalSectionId)
    if (!section) return
    onAddSessionItem(pendingName, section.name, modalSubsectionId ?? undefined)
    setAddName(``)
    setShowAdd(false)
    setShowModal(false)
    setPendingName(``)
    setModalSectionId(null)
    setModalSubsectionId(null)
  }

  function handleModalCancel() {
    setShowModal(false)
    setPendingName(``)
    setModalSectionId(null)
    setModalSubsectionId(null)
  }

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
            <button className="session-add-confirm" onClick={handleAdd}>+</button>
            <button className="btn-cancel-sm" onClick={handleCancelAdd}>✕</button>
          </div>
        ) : (
          <button className="session-add-btn" onClick={handleOpenAdd}>
            + Aggiungi articolo
          </button>
        )}
      </div>

      {/* ── Settore modal ── */}
      {showModal && (
        <div className="modal-bg show" onClick={handleModalCancel}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{`Aggiungi "${pendingName}"`}</h2>
            <p className="sub">Scegli il settore in cui inserire l&apos;articolo.</p>

            <div className="add-picker">
              {sortedSections.map(section => (
                <button
                  key={section.id}
                  className={`add-pick-btn${modalSectionId === section.id ? ` active` : ``}`}
                  onClick={() => handleSelectSection(section.id)}
                >
                  {section.emoji || `📦`} {section.name}
                </button>
              ))}
            </div>

            {needsSubsection && (
              <>
                <p className="sub" style={{ marginBottom: `10px` }}>Sotto-settore</p>
                <div className="add-picker" style={{ marginBottom: `20px` }}>
                  {namedSubs.map(sub => (
                    <button
                      key={sub.id}
                      className={`add-pick-btn${modalSubsectionId === sub.id ? ` active` : ``}`}
                      onClick={() => setModalSubsectionId(sub.id)}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="modal-btns">
              <button className="btn-ghost" onClick={handleModalCancel}>Annulla</button>
              <button
                className="btn-primary"
                disabled={!canConfirm}
                onClick={handleModalConfirm}
              >
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
