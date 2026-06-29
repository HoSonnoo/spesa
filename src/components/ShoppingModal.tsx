import { useState, useRef, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import type { SessionItem, List, Section, Subsection, Item } from '../types'

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── SuggestionsStrip ──────────────────────────────────────────────────────────

type Suggestion = { name: string; section_name: string; list_name: string }

function SuggestionsStrip({ onFetch, onAdd }: {
  onFetch: () => Promise<Suggestion[]>
  onAdd: (name: string, sectionName: string, listName: string) => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    onFetch().then(setSuggestions)
  }, [])

  if (dismissed || suggestions.length === 0) return null

  return (
    <div className="suggestions-strip">
      <span className="suggestions-label">Spesso:</span>
      <div className="suggestions-chips">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="suggestion-chip"
            onClick={() => {
              onAdd(s.name, s.section_name, s.list_name)
              setSuggestions(prev => prev.filter((_, j) => j !== i))
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
      <button className="suggestions-dismiss" onClick={() => setDismissed(true)}>×</button>
    </div>
  )
}

// ── SwipeableItem ─────────────────────────────────────────────────────────────

const THRESH = 72

function SwipeableItem({ si, onToggleBought, onUpdateQuantity, onUpdatePrice }: {
  si: SessionItem
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onUpdatePrice: (id: string, price: number) => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceStr, setPriceStr] = useState(si.price != null ? String(si.price) : ``)
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

  function savePriceEdit() {
    const raw = priceStr.replace(`,`, `.`)
    const val = parseFloat(raw)
    const price = isNaN(val) || val < 0 ? 0 : Math.round(val * 100) / 100
    setPriceStr(price > 0 ? String(price) : ``)
    onUpdatePrice(si.id, price)
    setEditingPrice(false)
  }

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
        <button className="qty-btn" onMouseDown={e => e.preventDefault()} onClick={() => onUpdateQuantity(si.id, Math.max(1, si.quantity - 1))}>−</button>
        <span className="qty-val">{si.quantity}</span>
        <button className="qty-btn" onMouseDown={e => e.preventDefault()} onClick={() => onUpdateQuantity(si.id, si.quantity + 1)}>+</button>
      </div>
      <div className="price-field" onClick={e => e.stopPropagation()}>
        <span>€</span>
        {editingPrice ? (
          <input
            type="number"
            min="0"
            step="0.01"
            className="price-input-inline"
            value={priceStr}
            onChange={e => setPriceStr(e.target.value)}
            onBlur={savePriceEdit}
            onKeyDown={e => { if (e.key === `Enter`) savePriceEdit(); if (e.key === `Escape`) setEditingPrice(false) }}
            autoFocus
          />
        ) : (
          <button
            className="price-display"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setEditingPrice(true); setPriceStr(si.price && si.price > 0 ? String(si.price) : ``) }}
          >
            {si.price && si.price > 0 ? si.price.toFixed(2) : `—`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({ sectionName, items, animKey, onToggleBought, onUpdateQuantity, onUpdatePrice }: {
  sectionName: string
  items: SessionItem[]
  animKey: number
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onUpdatePrice: (id: string, price: number) => void
}) {
  const boughtCount = items.filter(si => si.bought).length
  const total = items.length
  const pct = total > 0 ? Math.round((boughtCount / total) * 100) : 0

  return (
    <div key={animKey} className="section-card">
      <div className="section-card-head">
        <span className="section-card-name">{sectionName}</span>
        <span className="section-card-badge">{boughtCount}/{total}</span>
        {pct === 100 && <span className="section-card-done">✓</span>}
      </div>
      <div className={`progress${pct === 100 ? ` complete` : ``}`} style={{ margin: 0, borderRadius: 0 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="section-card-body">
        {items.map(si => (
          <SwipeableItem
            key={si.id}
            si={si}
            onToggleBought={onToggleBought}
            onUpdateQuantity={onUpdateQuantity}
            onUpdatePrice={onUpdatePrice}
          />
        ))}
      </div>
    </div>
  )
}

// ── ListSections (one list's section carousel) ────────────────────────────────

interface ListSectionsProps {
  list: List
  lists: List[]
  sessionItems: SessionItem[]
  sections: Section[]
  subsections: Subsection[]
  items: Item[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onUpdatePrice: (id: string, price: number) => void
  onAddSessionItem: (name: string, sectionName: string, listName: string, subsectionId?: string) => void
}

function ListSections({
  list,
  lists,
  sessionItems,
  sections,
  subsections,
  items,
  onToggleBought,
  onUpdateQuantity,
  onUpdatePrice,
  onAddSessionItem,
}: ListSectionsProps) {
  const [sectionIdx, setSectionIdx] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState(``)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [modalSectionId, setModalSectionId] = useState<string | null>(null)
  const [modalSubsectionId, setModalSubsectionId] = useState<string | null>(null)

  const touchStartX = useRef(0)
  const touchOnItem = useRef(false)

  const listItems = sessionItems.filter(si => si.list_name === list.name)
  const sectionNames = listItems.reduce<string[]>((acc, si) => {
    if (si.section_name && !acc.includes(si.section_name)) acc.push(si.section_name)
    return acc
  }, [])

  const safeSectionIdx = Math.min(sectionIdx, Math.max(0, sectionNames.length - 1))
  const currentSectionName = sectionNames[safeSectionIdx] ?? null

  const listSections = sections
    .filter(s => s.list_id === list.id)
    .sort((a, b) => a.position - b.position)

  const selectedSectionSubs = modalSectionId
    ? subsections.filter(s => s.section_id === modalSectionId).sort((a, b) => a.position - b.position)
    : []
  const namedSubs = selectedSectionSubs.filter(s => s.name !== ``)
  const canConfirm = !!modalSectionId && (namedSubs.length === 0 || !!modalSubsectionId)

  const inputTrimmed = addName.trim().toLowerCase()
  const addSuggestions: Item[] = showAdd && inputTrimmed.length > 0
    ? items.filter(i => i.name.toLowerCase().includes(inputTrimmed)).slice(0, 6)
    : []

  function handleSuggestionPick(item: Item) {
    const sub = subsections.find(s => s.id === item.subsection_id)
    const sec = sub ? sections.find(s => s.id === sub.section_id) : null
    const secList = sec ? lists.find(l => l.id === sec.list_id) : null
    const sectionName = sec?.name ?? currentSectionName ?? list.name
    const listName = secList?.name ?? list.name
    onAddSessionItem(item.name, sectionName, listName)
    setAddName(``)
    setShowAdd(false)
  }

  function navigate(newIdx: number) {
    setSectionIdx(newIdx)
    setAnimKey(k => k + 1)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchOnItem.current = !!(e.target as Element).closest(`.item`)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchOnItem.current || sectionNames.length <= 1) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 60) {
      if (dx < 0 && safeSectionIdx < sectionNames.length - 1) navigate(safeSectionIdx + 1)
      if (dx > 0 && safeSectionIdx > 0) navigate(safeSectionIdx - 1)
    }
  }

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
    const matchSec = listSections.find(s => s.name === currentSectionName)
    setModalSectionId(matchSec?.id ?? null)
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
    <div>
      {sectionNames.length === 0 ? (
        <div className="section-card" style={{ margin: `16px` }}>
          <div style={{ padding: `32px 20px`, textAlign: `center`, color: `var(--muted)`, fontSize: `14px` }}>
            {`Nessun articolo selezionato per ${list.emoji} ${list.name}.`}
          </div>
        </div>
      ) : (
        <div
          className="section-carousel-wrap"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <SectionCard
            key={animKey}
            sectionName={currentSectionName!}
            items={listItems.filter(si => si.section_name === currentSectionName)}
            animKey={animKey}
            onToggleBought={onToggleBought}
            onUpdateQuantity={onUpdateQuantity}
            onUpdatePrice={onUpdatePrice}
          />
        </div>
      )}

      {sectionNames.length > 1 && (
        <div className="section-nav">
          <button
            className="section-nav-arrow"
            disabled={safeSectionIdx === 0}
            onClick={() => navigate(safeSectionIdx - 1)}
          >‹</button>
          <div className="section-dots-row">
            {sectionNames.map((name, i) => (
              <button
                key={i}
                className={`modal-dot${i === safeSectionIdx ? ` active` : ``}`}
                onClick={() => navigate(i)}
                title={name}
              />
            ))}
          </div>
          <button
            className="section-nav-arrow"
            disabled={safeSectionIdx === sectionNames.length - 1}
            onClick={() => navigate(safeSectionIdx + 1)}
          >›</button>
        </div>
      )}

      <div className="session-add">
        {showAdd ? (
          <>
            <div className="session-add-form">
              <input
                placeholder={currentSectionName ? `Aggiungi a ${currentSectionName}…` : `Nome articolo…`}
                value={addName}
                onChange={e => setAddName(e.target.value)}
                onKeyDown={e => { if (e.key === `Enter`) handleAdd() }}
                autoFocus
              />
              <button className="session-add-confirm" onClick={handleAdd}>+</button>
              <button className="btn-cancel-sm" onClick={() => { setShowAdd(false); setAddName(``) }}>✕</button>
            </div>
            {addSuggestions.length > 0 && (
              <div className="add-suggestions">
                {addSuggestions.map(item => {
                  const sub = subsections.find(s => s.id === item.subsection_id)
                  const sec = sub ? sections.find(s => s.id === sub.section_id) : null
                  return (
                    <button
                      key={item.id}
                      className="add-suggestion-row"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSuggestionPick(item)}
                    >
                      <span className="add-suggestion-name">{item.name}</span>
                      {sec && <span className="add-suggestion-section">{sec.emoji || `📦`} {sec.name}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </>
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
  items: Item[]
  onToggleBought: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onUpdatePrice: (id: string, price: number) => void
  onAddSessionItem: (name: string, sectionName: string, listName: string, subsectionId?: string) => void
  onCompleteSession: () => void
  onClose: () => void
  onFetchSuggestions: () => Promise<Array<{ name: string; section_name: string; list_name: string }>>
}

export default function ShoppingModal({
  show,
  sessionItems,
  lists,
  sections,
  subsections,
  items,
  onToggleBought,
  onUpdateQuantity,
  onUpdatePrice,
  onAddSessionItem,
  onCompleteSession,
  onClose,
  onFetchSuggestions,
}: Props) {
  const [listPage, setListPage] = useState(0)

  const activeLists = lists.filter(l => sessionItems.some(si => si.list_name === l.name))
  const displayLists = activeLists.length > 0 ? activeLists : lists.slice(0, 1)
  const currentListPage = Math.min(listPage, Math.max(0, displayLists.length - 1))

  const boughtCount = sessionItems.filter(si => si.bought).length
  const total = sessionItems.length
  const totalPrice = sessionItems.reduce((sum, si) => sum + (si.price ?? 0) * si.quantity, 0)

  if (!show) return null

  return (
    <div className="shopping-modal-overlay" onClick={onClose}>
      <div className="shopping-modal-box" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="shopping-modal-header">
          <button className="icon-btn" onClick={onClose} title={`Chiudi`}>{CLOSE_ICON}</button>
          <span className="shopping-modal-title">
            {total > 0
              ? totalPrice > 0
                ? `${boughtCount}/${total} · € ${totalPrice.toFixed(2)}`
                : `${boughtCount} / ${total} articoli`
              : `Spesa in corso`}
          </span>
          <button className="shopping-modal-complete-btn" onClick={onCompleteSession}>
            Completa ✓
          </button>
        </div>

        {/* ── List tabs (solo se più liste) ── */}
        {displayLists.length > 1 && (
          <div className="shopping-modal-tabs">
            {displayLists.map((list, i) => (
              <button
                key={list.id}
                className={`shopping-modal-tab${i === currentListPage ? ` active` : ``}`}
                onClick={() => setListPage(i)}
              >
                {list.emoji} {list.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Suggerimenti da cronologia ── */}
        <SuggestionsStrip
          onFetch={onFetchSuggestions}
          onAdd={onAddSessionItem}
        />

        {/* ── Swipeable list body ── */}
        <div className="shopping-modal-body">
          <div
            className="shopping-pages-inner"
            style={{ transform: `translateX(-${currentListPage * 100}%)` }}
          >
            {displayLists.map(list => (
              <div key={list.id} className="shopping-page-slot">
                <ListSections
                  list={list}
                  lists={lists}
                  sessionItems={sessionItems}
                  sections={sections}
                  subsections={subsections}
                  items={items}
                  onToggleBought={onToggleBought}
                  onUpdateQuantity={onUpdateQuantity}
                  onUpdatePrice={onUpdatePrice}
                  onAddSessionItem={onAddSessionItem}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── List dots ── */}
        {displayLists.length > 1 && (
          <div className="shopping-modal-dots">
            {displayLists.map((_, i) => (
              <button
                key={i}
                className={`modal-dot${i === currentListPage ? ` active` : ``}`}
                onClick={() => setListPage(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
