import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Section, Subsection, Item } from '../types'
import DeleteSubsectionModal from './DeleteSubsectionModal'

// ── Icons ────────────────────────────────────────────────────────────────────

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const PENCIL = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
)

const GRIP = (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
    <circle cx="7" cy="5" r="1.5" />
    <circle cx="13" cy="5" r="1.5" />
    <circle cx="7" cy="10" r="1.5" />
    <circle cx="13" cy="10" r="1.5" />
    <circle cx="7" cy="15" r="1.5" />
    <circle cx="13" cy="15" r="1.5" />
  </svg>
)

const MOVE_ICON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const SEARCH_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const DOWNLOAD_ICON = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-hl">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── SortableRow ───────────────────────────────────────────────────────────────

type SortableChildProps = {
  setNodeRef: (el: HTMLElement | null) => void
  style: React.CSSProperties
  handleProps: object
  isDragging: boolean
}

function SortableRow({
  id,
  data,
  children,
}: {
  id: string
  data?: Record<string, unknown>
  children: (p: SortableChildProps) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }
  return <>{children({ setNodeRef, style, handleProps: { ...attributes, ...listeners }, isDragging })}</>
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sections: Section[]
  subsections: Subsection[]
  items: Item[]
  selectedIds: Set<string>
  sessionActive: boolean
  onToggleSelect: (itemId: string) => void
  onAddItem: (subsectionId: string, name: string) => void
  onUpdateItem: (itemId: string, name: string) => void
  onDeleteItem: (itemId: string) => void
  onReorderItems: (activeId: string, overId: string) => void
  onAddSection: (name: string, emoji: string) => void
  onAddSubsection: (sectionId: string, name: string) => void
  onDeleteSection: (sectionId: string) => void
  onDeleteSubsection: (subsectionId: string) => void
  onDeleteSubsectionWithChoice: (subsectionId: string, idsToDelete: string[]) => void
  onMoveItemToSubsection: (itemId: string, targetSubsectionId: string, newIndex?: number) => void
  onReorderSections: (activeId: string, overId: string) => void
  onReorderSubsections: (activeId: string, overId: string) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BaseList({
  sections,
  subsections,
  items,
  selectedIds,
  sessionActive,
  onToggleSelect,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onAddSection,
  onAddSubsection,
  onDeleteSection,
  onDeleteSubsection,
  onDeleteSubsectionWithChoice,
  onMoveItemToSubsection,
  onReorderSections,
  onReorderSubsections,
}: Props) {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addInputs, setAddInputs] = useState<Record<string, string>>({})
  const [addSubInputs, setAddSubInputs] = useState<Record<string, string>>({})
  const [addSubVisible, setAddSubVisible] = useState<Record<string, boolean>>({})
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionEmoji, setNewSectionEmoji] = useState('')
  const [showAddSection, setShowAddSection] = useState(false)
  const [editModes, setEditModes] = useState<Record<string, boolean>>({})
  const [deleteSubModal, setDeleteSubModal] = useState<{ subsectionId: string; items: Item[] } | null>(null)
  const [moveModal, setMoveModal] = useState<{ itemId: string; targets: Subsection[] } | null>(null)
  const [exportToast, setExportToast] = useState(false)

  // ── Drag state ────────────────────────────────────────────────────────────
  const [localItems, setLocalItems] = useState<Item[]>(items)
  const [dragging, setDragging] = useState(false)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!dragging) setLocalItems(items)
  }, [items, dragging])

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const sortedSections = [...sections].sort((a, b) => a.position - b.position)

  // ── Export ────────────────────────────────────────────────────────────────

  function buildExportText(): string {
    const lines: string[] = [`Lista della Spesa`, `─`.repeat(22), ``]

    for (const section of sortedSections) {
      const sectionSubs = [...subsections]
        .filter(s => s.section_id === section.id)
        .sort((a, b) => a.position - b.position)

      const hasItems = sectionSubs.some(sub => items.some(i => i.subsection_id === sub.id))
      if (!hasItems) continue

      lines.push(`${section.emoji || `📦`} ${section.name}`)

      for (const sub of sectionSubs) {
        const subItems = [...items]
          .filter(i => i.subsection_id === sub.id)
          .sort((a, b) => a.position - b.position)

        if (subItems.length === 0) continue

        if (sub.name) {
          lines.push(`  ${sub.name}`)
          for (const item of subItems) lines.push(`    • ${item.name}`)
        } else {
          for (const item of subItems) lines.push(`  • ${item.name}`)
        }
      }

      lines.push(``)
    }

    return lines.join(`\n`)
  }

  async function exportList() {
    const text = buildExportText()

    if (navigator.share) {
      try {
        await navigator.share({ title: `Lista della Spesa`, text })
        return
      } catch (e: unknown) {
        if (e instanceof Error && e.name === `AbortError`) return
      }
    }

    await navigator.clipboard.writeText(text)
    setExportToast(true)
    setTimeout(() => setExportToast(false), 2200)
  }

  // ── Search filtering ──────────────────────────────────────────────────────
  const query = searchQuery.toLowerCase().trim()
  const isSearching = query.length > 0

  function itemMatchesSearch(item: Item) {
    return item.name.toLowerCase().includes(query)
  }
  function subHasMatches(sub: Subsection) {
    if (!isSearching) return true
    const subItems = localItems.filter(i => i.subsection_id === sub.id)
    return sub.name.toLowerCase().includes(query) || subItems.some(itemMatchesSearch)
  }
  function sectionHasMatches(section: Section) {
    if (!isSearching) return true
    const sectionSubs = subsections.filter(s => s.section_id === section.id)
    return section.name.toLowerCase().includes(query) || sectionSubs.some(subHasMatches)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleCollapse(id: string) {
    if (editModes[id] || isSearching) return
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditValue(item.name)
  }

  function saveEdit(itemId: string) {
    const trimmed = editValue.trim()
    if (trimmed) onUpdateItem(itemId, trimmed)
    setEditingId(null)
  }

  function handleAddItem(subsectionId: string) {
    const val = (addInputs[subsectionId] ?? '').trim()
    if (!val) return
    onAddItem(subsectionId, val)
    setAddInputs(prev => ({ ...prev, [subsectionId]: '' }))
  }

  function handleAddSubsection(sectionId: string) {
    const val = (addSubInputs[sectionId] ?? '').trim()
    if (!val) return
    onAddSubsection(sectionId, val)
    setAddSubInputs(prev => ({ ...prev, [sectionId]: '' }))
    setAddSubVisible(prev => ({ ...prev, [sectionId]: false }))
  }

  function handleAddSection() {
    const name = newSectionName.trim()
    if (!name) return
    onAddSection(name, newSectionEmoji.trim() || '📦')
    setNewSectionName('')
    setNewSectionEmoji('')
    setShowAddSection(false)
  }

  function toggleEditMode(sectionId: string) {
    setEditModes(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  function handleDeleteSubsection(sub: Subsection) {
    const subItems = localItems.filter(i => i.subsection_id === sub.id)
    if (subItems.length > 0) {
      setDeleteSubModal({ subsectionId: sub.id, items: subItems })
    } else {
      onDeleteSubsection(sub.id)
    }
  }

  function handleMoveItem(item: Item, sectionSubs: Subsection[]) {
    const targets = sectionSubs.filter(s => s.id !== item.subsection_id)
    if (targets.length > 0) setMoveModal({ itemId: item.id, targets })
  }

  // ── Per-section drag handlers ─────────────────────────────────────────────

  function onContentDragStart(e: DragStartEvent) {
    setDragging(true)
    if (e.active.data.current?.type === 'item') setActiveItemId(String(e.active.id))
  }

  function onContentDragOver(e: DragOverEvent, sectionSubs: Subsection[]) {
    const { active, over } = e
    if (!over) return
    if (active.data.current?.type !== 'item') return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setLocalItems(prev => {
      const activeItem = prev.find(i => i.id === activeId)
      if (!activeItem) return prev

      const overItem = prev.find(i => i.id === overId)
      const overSub = sectionSubs.find(s => s.id === overId)

      let targetSubId: string | null = null
      if (overItem && overItem.subsection_id !== activeItem.subsection_id) {
        targetSubId = overItem.subsection_id
      } else if (overSub && overSub.id !== activeItem.subsection_id) {
        targetSubId = overSub.id
      }
      if (!targetSubId) return prev

      const withoutActive = prev.filter(i => i.id !== activeId)
      const targetItems = withoutActive
        .filter(i => i.subsection_id === targetSubId)
        .sort((a, b) => a.position - b.position)

      let insertIndex = targetItems.length
      if (overItem) {
        const idx = targetItems.findIndex(i => i.id === overId)
        if (idx !== -1) insertIndex = idx
      }

      const newTarget = [...targetItems]
      newTarget.splice(insertIndex, 0, { ...activeItem, subsection_id: targetSubId })
      const updatedTarget = newTarget.map((i, pos) => ({ ...i, position: pos }))

      return [
        ...withoutActive.filter(i => i.subsection_id !== targetSubId),
        ...updatedTarget,
      ]
    })
  }

  function onContentDragEnd(e: DragEndEvent, sectionSubs: Subsection[]) {
    const activeId = String(e.active.id)
    const originalSubId = items.find(i => i.id === activeId)?.subsection_id

    setDragging(false)
    setActiveItemId(null)

    if (!e.over) {
      setLocalItems(items)
      return
    }

    const overId = String(e.over.id)

    if (e.active.data.current?.type === 'subsection') {
      if (sectionSubs.some(s => s.id === overId)) onReorderSubsections(activeId, overId)
      return
    }

    const finalItem = localItems.find(i => i.id === activeId)
    if (!finalItem) return

    if (finalItem.subsection_id !== originalSubId) {
      onMoveItemToSubsection(activeId, finalItem.subsection_id, finalItem.position)
    } else if (activeId !== overId) {
      onReorderItems(activeId, overId)
    }
  }

  // ── Add section UI ────────────────────────────────────────────────────────

  const addSectionUI = !sessionActive && !isSearching && (
    <div className="section-add">
      {showAddSection ? (
        <div className="add-section-form">
          <input
            className="emoji-input"
            placeholder="📦"
            value={newSectionEmoji}
            onChange={e => setNewSectionEmoji(e.target.value)}
            maxLength={4}
          />
          <input
            placeholder="Nome categoria"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection() }}
            autoFocus
          />
          <button className="btn-add" onClick={handleAddSection}>+</button>
          <button className="btn-cancel-sm" onClick={() => setShowAddSection(false)}>✕</button>
        </div>
      ) : (
        <button className="add-section-btn" onClick={() => setShowAddSection(true)}>
          + Nuova categoria
        </button>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  const visibleSections = isSearching
    ? sortedSections.filter(sectionHasMatches)
    : sortedSections

  return (
    <div>
      {/* ── Search bar ── */}
      {!sessionActive && (
        <div className="search-bar">
          <div className="search-bar-row">
            <div className="search-input-wrap">
              <span className="search-icon">{SEARCH_ICON}</span>
              <input
                type="search"
                placeholder="Cerca articoli…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
            <button className="export-btn" onClick={exportList} title={`Esporta lista`}>
              {DOWNLOAD_ICON}
            </button>
          </div>
        </div>
      )}

      {isSearching && visibleSections.length === 0 && (
        <div className="empty">Nessun risultato per "{searchQuery}".</div>
      )}

      {/* ── Outer DndContext: sections ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          if (e.over) onReorderSections(String(e.active.id), String(e.over.id))
        }}
      >
        <SortableContext items={visibleSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {visibleSections.map(section => {
            const allSectionSubs = [...subsections]
              .filter(s => s.section_id === section.id)
              .sort((a, b) => a.position - b.position)
            const sectionSubs = isSearching
              ? allSectionSubs.filter(subHasMatches)
              : allSectionSubs
            const editing = !isSearching && !!editModes[section.id]
            const isCollapsed = !editing && !isSearching && !!collapsed[section.id]

            return (
              <SortableRow key={section.id} id={section.id} data={{ type: 'section' }}>
                {({ setNodeRef, style, handleProps }) => (
                  <div ref={setNodeRef} style={style} className={`section${isCollapsed ? ' collapsed' : ''}`}>

                    {/* Section header */}
                    <div className="section-head" onClick={() => toggleCollapse(section.id)}>
                      {!sessionActive && !isSearching && (
                        <button className="drag-handle" {...handleProps} onClick={e => e.stopPropagation()}>
                          {GRIP}
                        </button>
                      )}
                      <span className="emoji">{section.emoji || '📦'}</span>
                      <span className="section-name">{highlight(section.name, query)}</span>
                      {editing ? (
                        <div className="edit-controls" onClick={e => e.stopPropagation()}>
                          <button className="move-btn danger" onClick={() => onDeleteSection(section.id)}>🗑</button>
                          <button className="move-btn done-btn" onClick={() => toggleEditMode(section.id)}>✓</button>
                        </div>
                      ) : (
                        <div className="section-head-right" onClick={e => e.stopPropagation()}>
                          {!sessionActive && !isSearching && (
                            <button className="section-edit-btn" onClick={() => toggleEditMode(section.id)}>
                              {PENCIL}
                            </button>
                          )}
                          <span className="chev">▼</span>
                        </div>
                      )}
                    </div>

                    {/* Section body */}
                    <div className="section-body">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={onContentDragStart}
                        onDragOver={e => onContentDragOver(e, allSectionSubs)}
                        onDragEnd={e => onContentDragEnd(e, allSectionSubs)}
                      >
                        <SortableContext items={sectionSubs.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          {sectionSubs.map(sub => {
                            const allSubItems = localItems
                              .filter(i => i.subsection_id === sub.id)
                              .sort((a, b) => a.position - b.position)
                            const subItems = isSearching
                              ? allSubItems.filter(itemMatchesSearch)
                              : allSubItems

                            return (
                              <SortableRow key={sub.id} id={sub.id} data={{ type: 'subsection' }}>
                                {({ setNodeRef: setSubRef, style: subStyle, handleProps: subHandleProps }) => (
                                  <div ref={setSubRef} style={subStyle} className="subsection">

                                    {(sub.name || editing) && (
                                      <div className="sub-label-row">
                                        {editing && (
                                          <button className="drag-handle drag-handle--sm" {...subHandleProps}>
                                            {GRIP}
                                          </button>
                                        )}
                                        <div className="sub-label">{highlight(sub.name || `(senza nome)`, query)}</div>
                                        {editing && (
                                          <button
                                            className="move-btn danger"
                                            onClick={() => handleDeleteSubsection(sub)}
                                          >🗑</button>
                                        )}
                                      </div>
                                    )}

                                    <SortableContext items={subItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                      {subItems.map(item => {
                                        const isSelected = selectedIds.has(item.id)
                                        const isEditing = editingId === item.id
                                        const canMove = allSectionSubs.length > 1

                                        return (
                                          <SortableRow key={item.id} id={item.id} data={{ type: 'item' }}>
                                            {({ setNodeRef: setItemRef, style: itemStyle, handleProps: itemHandleProps, isDragging: itemDragging }) => (
                                              <div
                                                ref={setItemRef}
                                                style={itemStyle}
                                                className={`item${itemDragging ? ' item--ghost' : ''}`}
                                              >
                                                {isEditing ? (
                                                  <>
                                                    <input
                                                      className="inline-edit-input"
                                                      value={editValue}
                                                      onChange={e => setEditValue(e.target.value)}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEdit(item.id)
                                                        if (e.key === 'Escape') setEditingId(null)
                                                      }}
                                                      onBlur={() => saveEdit(item.id)}
                                                      autoFocus
                                                      onClick={e => e.stopPropagation()}
                                                    />
                                                    <button
                                                      className="item-act danger"
                                                      onMouseDown={e => e.preventDefault()}
                                                      onClick={() => { onDeleteItem(item.id); setEditingId(null) }}
                                                    >🗑</button>
                                                  </>
                                                ) : editing ? (
                                                  <>
                                                    <button className="drag-handle drag-handle--sm" {...itemHandleProps}>
                                                      {GRIP}
                                                    </button>
                                                    <span className="item-name">{item.name}</span>
                                                    {canMove && (
                                                      <button
                                                        className="item-act item-act--move"
                                                        title="Sposta in altra sottocategoria"
                                                        onClick={() => handleMoveItem(item, allSectionSubs)}
                                                      >
                                                        {MOVE_ICON}
                                                      </button>
                                                    )}
                                                    <button
                                                      className="item-act danger"
                                                      onClick={() => onDeleteItem(item.id)}
                                                    >🗑</button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <div
                                                      className={`check${isSelected ? ' on' : ''}`}
                                                      onClick={() => !sessionActive && onToggleSelect(item.id)}
                                                    >
                                                      {CHECK}
                                                    </div>
                                                    <span
                                                      className="item-name"
                                                      onClick={() => !sessionActive && onToggleSelect(item.id)}
                                                    >
                                                      {highlight(item.name, query)}
                                                    </span>
                                                    {!sessionActive && (
                                                      <button
                                                        className="item-act"
                                                        onClick={e => { e.stopPropagation(); startEdit(item) }}
                                                      >⋯</button>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </SortableRow>
                                        )
                                      })}
                                    </SortableContext>

                                    {!editing && !isSearching && (
                                      <div className="add-row">
                                        <input
                                          placeholder={`Aggiungi a ${sub.name || section.name}…`}
                                          value={addInputs[sub.id] ?? ''}
                                          onChange={e => setAddInputs(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                          onKeyDown={e => { if (e.key === 'Enter') handleAddItem(sub.id) }}
                                          disabled={sessionActive}
                                        />
                                        <button onClick={() => handleAddItem(sub.id)} disabled={sessionActive}>
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </SortableRow>
                            )
                          })}
                        </SortableContext>

                        <DragOverlay dropAnimation={null}>
                          {activeItemId ? (() => {
                            const ghost = localItems.find(i => i.id === activeItemId)
                            return ghost ? (
                              <div className="item item--drag-overlay">
                                <span className="drag-handle drag-handle--sm">{GRIP}</span>
                                <span className="item-name">{ghost.name}</span>
                              </div>
                            ) : null
                          })() : null}
                        </DragOverlay>
                      </DndContext>

                      {!sessionActive && !editing && !isSearching && (
                        <div className="sub-add-wrap">
                          {addSubVisible[section.id] ? (
                            <div className="add-row">
                              <input
                                placeholder="Nome sottocategoria…"
                                value={addSubInputs[section.id] ?? ''}
                                onChange={e => setAddSubInputs(prev => ({ ...prev, [section.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddSubsection(section.id) }}
                                autoFocus
                              />
                              <button onClick={() => handleAddSubsection(section.id)}>+</button>
                            </div>
                          ) : (
                            <button
                              className="add-sub-btn"
                              onClick={() => setAddSubVisible(prev => ({ ...prev, [section.id]: true }))}
                            >
                              + Sottocategoria
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </SortableRow>
            )
          })}
        </SortableContext>
      </DndContext>

      {addSectionUI}

      {/* ── Delete subsection modal ── */}
      {deleteSubModal && (
        <DeleteSubsectionModal
          items={deleteSubModal.items}
          onConfirm={idsToDelete => {
            onDeleteSubsectionWithChoice(deleteSubModal.subsectionId, idsToDelete)
            setDeleteSubModal(null)
          }}
          onCancel={() => setDeleteSubModal(null)}
        />
      )}

      {/* ── Move item modal ── */}
      {moveModal && (
        <div className="modal-bg show" onClick={() => setMoveModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Sposta in…</h2>
            <p className="sub">Scegli la sottocategoria di destinazione.</p>
            <div className="sub-pick-list">
              {moveModal.targets.map(target => (
                <button
                  key={target.id}
                  className="sub-pick-btn"
                  onClick={() => {
                    onMoveItemToSubsection(moveModal.itemId, target.id)
                    setMoveModal(null)
                  }}
                >
                  {target.name || `(senza nome)`}
                </button>
              ))}
            </div>
            <div className="modal-btns">
              <button className="btn-ghost" onClick={() => setMoveModal(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {exportToast && (
        <div className="export-toast">Copiato negli appunti ✓</div>
      )}
    </div>
  )
}
