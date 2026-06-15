import { useState, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import type { SessionItem, List, Section, Subsection } from '../types'

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ── SwipeableItem ─────────────────────────────────────────────────────────────

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
      className={`item${si.bought ? ` done` : ``}`}
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

// ── Per-list page ─────────────────────────────────────────────────────────────

interface ListPageProps {
  list: List
  sessionItems: SessionItem[]
  sections: Section[]
  subsections: Subsection[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onAddSessionItem: (name: string, sectionName: string, listName: string, subsectionId?: string) => void
}

function ListPage({
  list,
  sessionItems,
  sections,
  subsections,
  onToggleBought,
  onUpdateQuantity,
  onAddSessionItem,
}: ListPageProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState(``)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [modalSectionId, setModalSectionId] = useState<string | null>(null)
  const [modalSubsectionId, setModalSubsectionId] = useState<string | null>(null)

  const listItems = sessionItems.filter(si => si.list_name === list.name)
  const listSections = sections
    .filter(s => s.list_id === list.id)
    .sort((a, b) => a.position - b.position)

  const boughtCount = listItems.filter(si => si.bought).length
  const total = listItems.length
  const pct = total > 0 ? Math.round((boughtCount / total) * 100) : 0

  const groups: Record<string, SessionItem[]> = {}
  for (const si of listItems) {
    if (!groups[si.section_name]) groups[si.section_name] = []
    groups[si.section_name].push(si)
  }

  const selectedSectionSubs = modalSectionId
    ? subsections
        .filter(s => s.section_id === modalSectionId)
        .sort((a, b) => a.position - b.position)
    : []
  const namedSubs = selectedSectionSubs.filter(s => s.name !== ``)
  const canConfirm = !!modalSectionId && (namedSubs.length === 0 || !!modalSubsectionId)

  function handleAdd() {
    const name = addName.trim()
    if (!name) return
    if (listSections.length === 0) {
      onAddSessionItem(name, list.name, list.name)
      setAddName(``)
      setShowAdd(false)
      return
    }
    setPendingName(name)
    setModalSectionId(null)
    setModalSubsectionId(null)
  }

  function handleModalConfirm() {
    if (!modalSectionId || !pendingName) return
    const section = listSections.find(s => s.id === modalSectionId)
    if (!section) return
    onAddSessionItem(pendingName, section.name, list.name, modalSubsectionId ?? undefined)
    setAddName(``)
    setShowAdd(false)
    setPendingName(null)
    setModalSectionId(null)
    setModalSubsectionId(null)
  }

  function closePickerModal() {
    setPendingName(null)
    setModalSectionId(null)
    setModalSubsectionId(null)
  }

  return (
    <div className="shopping-page">
      {total > 0 && (
        <div className={`progress${pct === 100 ? ` complete` : ``}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: `32px 20px`, textAlign: `center`, color: `var(--muted)`, fontSize: `14px` }}>
          {`Nessun articolo selezionato per ${list.emoji} ${list.name}.`}
          <br />
          <span style={{ fontSize: `13px`, marginTop: `4px`, display: `block` }}>
            Aggiungi articoli qui sotto oppure selezionali dalla Lista base.
          </span>
        </div>
      ) : (
        Object.entries(groups).map(([sectionName, groupItems]) => (
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
        ))
      )}

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
            <button className="btn-cancel-sm" onClick={() => { setShowAdd(false); setAddName(``) }}>✕</button>
          </div>
        ) : (
          <button className="session-add-btn" onClick={() => setShowAdd(true)}>
            {`+ Aggiungi a ${list.name}`}
          </button>
        )}
      </div>

      {pendingName && (
        <div className="modal-bg show" onClick={closePickerModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{`Aggiungi "${pendingName}"`}</h2>
            <p className="sub">Scegli il settore in cui inserire l&apos;articolo.</p>
            <div className="add-picker">
              {listSections.map(sec => (
                <button
                  key={sec.id}
                  className={`add-pick-btn${modalSectionId === sec.id ? ` active` : ``}`}
                  onClick={() => { setModalSectionId(sec.id); setModalSubsectionId(null) }}
                >
                  {sec.emoji || `📦`} {sec.name}
                </button>
              ))}
            </div>
            {namedSubs.length > 0 && (
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
              <button className="btn-ghost" onClick={closePickerModal}>Annulla</button>
              <button className="btn-primary" disabled={!canConfirm} onClick={handleModalConfirm}>
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ShoppingModal ─────────────────────────────────────────────────────────────

interface Props {
  show: boolean
  sessionItems: SessionItem[]
  lists: List[]
  sections: Section[]
  subsections: Subsection[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onAddSessionItem: (name: string, sectionName: string, listName: string, subsectionId?: string) => void
  onCompleteSession: () => void
  onClose: () => void
}

export default function ShoppingModal({
  show,
  sessionItems,
  lists,
  sections,
  subsections,
  onToggleBought,
  onUpdateQuantity,
  onAddSessionItem,
  onCompleteSession,
  onClose,
}: Props) {
  const [page, setPage] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchOnItem = useRef(false)

  const activeLists = lists.filter(l => sessionItems.some(si => si.list_name === l.name))
  const displayLists = activeLists.length > 0 ? activeLists : lists.slice(0, 1)
  const currentPage = Math.min(page, Math.max(0, displayLists.length - 1))

  const boughtCount = sessionItems.filter(si => si.bought).length
  const total = sessionItems.length

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchOnItem.current = !!(e.target as Element).closest(`.item`)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchOnItem.current || displayLists.length <= 1) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0 && currentPage < displayLists.length - 1) setPage(p => Math.min(p + 1, displayLists.length - 1))
      if (dx > 0 && currentPage > 0) setPage(p => Math.max(p - 1, 0))
    }
  }

  if (!show) return null

  return (
    <div className="shopping-modal-overlay" onClick={onClose}>
      <div className="shopping-modal-box" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="shopping-modal-header">
          <button className="icon-btn" onClick={onClose} title={`Chiudi`}>
            {CLOSE_ICON}
          </button>
          <span className="shopping-modal-title">
            {total > 0 ? `${boughtCount} / ${total} articoli` : `Spesa in corso`}
          </span>
          <button className="shopping-modal-complete-btn" onClick={onCompleteSession}>
            Completa ✓
          </button>
        </div>

        {/* ── List tabs (only when multiple lists) ── */}
        {displayLists.length > 1 && (
          <div className="shopping-modal-tabs">
            {displayLists.map((list, i) => (
              <button
                key={list.id}
                className={`shopping-modal-tab${i === currentPage ? ` active` : ``}`}
                onClick={() => setPage(i)}
              >
                {list.emoji} {list.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Swipeable body ── */}
        <div
          className="shopping-modal-body"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="shopping-pages-inner"
            style={{ transform: `translateX(-${currentPage * 100}%)` }}
          >
            {displayLists.map(list => (
              <div key={list.id} className="shopping-page-slot">
                <ListPage
                  list={list}
                  sessionItems={sessionItems}
                  sections={sections}
                  subsections={subsections}
                  onToggleBought={onToggleBought}
                  onUpdateQuantity={onUpdateQuantity}
                  onAddSessionItem={onAddSessionItem}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Page indicator dots ── */}
        {displayLists.length > 1 && (
          <div className="shopping-modal-dots">
            {displayLists.map((_, i) => (
              <button
                key={i}
                className={`modal-dot${i === currentPage ? ` active` : ``}`}
                onClick={() => setPage(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
