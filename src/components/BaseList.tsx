import { useState, useEffect, useRef } from 'react'
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
import type { List, Section, Subsection, Item, ImportRow } from '../types'
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

const COPY_ICON = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const UPLOAD_ICON = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
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

// ── SwipeDeleteItem ───────────────────────────────────────────────────────────

function SwipeDeleteItem({
  setNodeRef,
  style,
  isDragging,
  disabled,
  children,
  onDelete,
}: {
  setNodeRef: (el: HTMLElement | null) => void
  style: React.CSSProperties
  isDragging: boolean
  disabled: boolean
  children: React.ReactNode
  onDelete: () => void
}) {
  const [swipeX, setSwipeX] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const horizLocked = useRef(false)

  const clamp = Math.max(-80, swipeX)
  const prog = Math.min(1, Math.abs(clamp) / 80)
  const isSwiping = swipeX < -8

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...(isSwiping ? { transform: `translateX(${clamp * 0.5}px)`, transition: `none` } : {}),
        position: `relative`,
        overflow: `hidden`,
      }}
      className={`item${isDragging ? ` item--ghost` : ``}`}
      onTouchStart={disabled ? undefined : e => {
        startX.current = e.touches[0].clientX
        startY.current = e.touches[0].clientY
        horizLocked.current = false
      }}
      onTouchMove={disabled ? undefined : e => {
        const dx = e.touches[0].clientX - startX.current
        const dy = e.touches[0].clientY - startY.current
        if (!horizLocked.current) {
          if (Math.abs(dy) >= Math.abs(dx) || dx > 0) return
          horizLocked.current = true
        }
        e.preventDefault()
        setSwipeX(dx)
      }}
      onTouchEnd={disabled ? undefined : () => {
        if (swipeX < -80) {
          navigator.vibrate?.(30)
          onDelete()
        }
        setSwipeX(0)
        horizLocked.current = false
      }}
    >
      {isSwiping && (
        <div className="swipe-delete-bg" style={{ opacity: prog }}>🗑</div>
      )}
      {children}
    </div>
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
  lists: List[]
  activeListId: string | null
  onSetActiveListId: (id: string) => void
  onAddList: (name: string, emoji: string) => void
  onUpdateList: (id: string, name: string, emoji: string) => void
  onDeleteList: (id: string) => void
  onReorderLists: (activeId: string, overId: string) => void
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
  onImportItems: (rows: ImportRow[], mode: 'overwrite' | 'add-all' | 'add-new') => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BaseList({
  lists,
  activeListId,
  onSetActiveListId,
  onAddList,
  onUpdateList,
  onDeleteList,
  onReorderLists,
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
  onImportItems,
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
  const [moveModal, setMoveModal] = useState<{ itemId: string } | null>(null)
  const [exportToast, setExportToast] = useState(false)
  const [showListManager, setShowListManager] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editListName, setEditListName] = useState(``)
  const [editListEmoji, setEditListEmoji] = useState(``)
  const [newListName, setNewListName] = useState(``)
  const [newListEmoji, setNewListEmoji] = useState(``)
  const [showAddList, setShowAddList] = useState(false)
  const [importErrToast, setImportErrToast] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const sortedLists = [...lists].sort((a, b) => a.position - b.position)

  // ── Export / Import helpers ───────────────────────────────────────────────

  function buildTextContent(): string {
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

  function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"'
    }
    return value
  }

  function buildCSVContent(): string {
    const lines = [`Emoji,Sezione,Sottosezione,Articolo`]
    for (const section of sortedSections) {
      const sectionSubs = [...subsections]
        .filter(s => s.section_id === section.id)
        .sort((a, b) => a.position - b.position)
      for (const sub of sectionSubs) {
        const subItems = [...items]
          .filter(i => i.subsection_id === sub.id)
          .sort((a, b) => a.position - b.position)
        for (const item of subItems) {
          lines.push([
            escapeCSV(section.emoji || `📦`),
            escapeCSV(section.name),
            escapeCSV(sub.name),
            escapeCSV(item.name),
          ].join(`,`))
        }
      }
    }
    return lines.join(`\n`)
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ``
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === `"`) {
        if (inQuotes && line[i + 1] === `"`) { current += `"`; i++ }
        else inQuotes = !inQuotes
      } else if (ch === `,` && !inQuotes) {
        result.push(current); current = ``
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  function parseImportCSV(raw: string): ImportRow[] {
    const text = raw.startsWith(`﻿`) ? raw.slice(1) : raw
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []
    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
    const emojiIdx = header.indexOf(`emoji`)
    const sectionIdx = header.indexOf(`sezione`)
    const subIdx = header.indexOf(`sottosezione`)
    const itemIdx = header.indexOf(`articolo`)
    if (sectionIdx === -1 || itemIdx === -1) return []
    const rows: ImportRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const itemName = (itemIdx < cols.length ? cols[itemIdx] : ``).trim()
      const sectionName = (sectionIdx < cols.length ? cols[sectionIdx] : ``).trim()
      if (!itemName || !sectionName) continue
      rows.push({
        emoji: emojiIdx >= 0 && emojiIdx < cols.length ? cols[emojiIdx].trim() : `📦`,
        sectionName,
        subsectionName: subIdx >= 0 && subIdx < cols.length ? cols[subIdx].trim() : ``,
        itemName,
      })
    }
    return rows
  }

  // ── Export / Import actions ───────────────────────────────────────────────

  async function copyList() {
    const text = buildTextContent()
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

  function downloadCSV() {
    const csv = buildCSVContent()
    const blob = new Blob([`﻿` + csv], { type: `text/csv;charset=utf-8;` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement(`a`)
    a.href = url
    a.download = `lista-spesa-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      const text = event.target?.result as string
      const rows = parseImportCSV(text)
      if (rows.length === 0) {
        setImportErrToast(true)
        setTimeout(() => setImportErrToast(false), 2200)
        return
      }
      if (items.length > 0) {
        setImportRows(rows)
      } else {
        onImportItems(rows, `add-all`)
      }
    }
    reader.readAsText(file, `utf-8`)
    if (fileInputRef.current) fileInputRef.current.value = ``
  }

  // ── Search filtering ──────────────────────────────────────────────────────
  const query = searchQuery.toLowerCase().trim()
  const isSearching = query.length > 0

  const sortedSections = [...sections]
    .filter(s => !activeListId || isSearching || s.list_id === activeListId)
    .sort((a, b) => a.position - b.position)

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

  function handleMoveItem(item: Item) {
    const hasTargets = subsections.some(s => s.id !== item.subsection_id)
    if (hasTargets) setMoveModal({ itemId: item.id })
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

  // ── List manager helpers ──────────────────────────────────────────────────

  function saveEditList(listId: string) {
    const name = editListName.trim()
    if (name) onUpdateList(listId, name, editListEmoji.trim() || `📋`)
    setEditingListId(null)
  }

  function handleAddList() {
    const name = newListName.trim()
    if (!name) return
    onAddList(name, newListEmoji.trim() || `📋`)
    setNewListName(``)
    setNewListEmoji(``)
    setShowAddList(false)
  }

  function closeListManager() {
    setShowListManager(false)
    setEditingListId(null)
    setShowAddList(false)
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
      {/* ── List selector ── */}
      {lists.length > 0 && (
        <div className="list-selector">
          {sortedLists.map(list => (
            <button
              key={list.id}
              className={`list-selector-btn${list.id === activeListId ? ` active` : ``}`}
              onClick={() => onSetActiveListId(list.id)}
            >
              {list.emoji} {list.name}
            </button>
          ))}
          <button
            className="list-selector-manage"
            onClick={() => setShowListManager(true)}
            title="Gestisci liste"
          >⚙</button>
        </div>
      )}

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
            <div className="export-actions">
              <button className="export-btn" onClick={copyList} title={`Copia lista`}>
                {COPY_ICON}
              </button>
              <button className="export-btn" onClick={downloadCSV} title={`Scarica lista (CSV)`}>
                {DOWNLOAD_ICON}
              </button>
              <button className="export-btn" onClick={() => fileInputRef.current?.click()} title={`Importa lista (CSV)`}>
                {UPLOAD_ICON}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: `none` }}
              onChange={handleFileChange}
            />
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
                      {isSearching && section.list_id !== activeListId && (() => {
                        const list = lists.find(l => l.id === section.list_id)
                        return list ? <span className="section-list-badge">{list.emoji} {list.name}</span> : null
                      })()}
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
                                        const canMove = subsections.some(s => s.id !== item.subsection_id)

                                        return (
                                          <SortableRow key={item.id} id={item.id} data={{ type: 'item' }}>
                                            {({ setNodeRef: setItemRef, style: itemStyle, handleProps: itemHandleProps, isDragging: itemDragging }) => (
                                              <SwipeDeleteItem
                                                setNodeRef={setItemRef}
                                                style={itemStyle}
                                                isDragging={itemDragging}
                                                disabled={isEditing || editing || sessionActive || isSearching}
                                                onDelete={() => onDeleteItem(item.id)}
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
                                                        title="Sposta in altra categoria"
                                                        onClick={() => handleMoveItem(item)}
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
                                              </SwipeDeleteItem>
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

      {/* ── List manager modal ── */}
      {showListManager && (
        <div className="modal-bg show" onClick={closeListManager}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Gestisci liste</h2>
            <p className="sub">Trascina per riordinare. Tocca il nome per modificarlo.</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={e => {
                if (e.over) onReorderLists(String(e.active.id), String(e.over.id))
              }}
            >
              <SortableContext items={sortedLists.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className="list-manager-rows">
                  {sortedLists.map(list => (
                    <SortableRow key={list.id} id={list.id}>
                      {({ setNodeRef, style, handleProps }) => (
                        <div ref={setNodeRef} style={style} className="list-manager-row">
                          <button className="drag-handle" {...handleProps} onClick={e => e.stopPropagation()}>
                            {GRIP}
                          </button>
                          {editingListId === list.id ? (
                            <>
                              <input
                                className="emoji-input"
                                value={editListEmoji}
                                onChange={e => setEditListEmoji(e.target.value)}
                                maxLength={4}
                                style={{ width: `48px` }}
                              />
                              <input
                                className="list-manager-name-input"
                                value={editListName}
                                onChange={e => setEditListName(e.target.value)}
                                onBlur={() => saveEditList(list.id)}
                                onKeyDown={e => {
                                  if (e.key === `Enter`) saveEditList(list.id)
                                  if (e.key === `Escape`) setEditingListId(null)
                                }}
                                autoFocus
                              />
                            </>
                          ) : (
                            <span
                              className="list-manager-name"
                              onClick={() => { setEditingListId(list.id); setEditListName(list.name); setEditListEmoji(list.emoji) }}
                            >
                              {list.emoji} {list.name}
                            </span>
                          )}
                          <button
                            className="move-btn danger"
                            onClick={() => { onDeleteList(list.id) }}
                            disabled={lists.length <= 1}
                          >🗑</button>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {showAddList ? (
              <div className="add-section-form" style={{ marginTop: `12px` }}>
                <input
                  className="emoji-input"
                  placeholder="📋"
                  value={newListEmoji}
                  onChange={e => setNewListEmoji(e.target.value)}
                  maxLength={4}
                />
                <input
                  placeholder="Nome lista"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === `Enter`) handleAddList() }}
                  autoFocus
                />
                <button className="btn-add" onClick={handleAddList}>+</button>
                <button className="btn-cancel-sm" onClick={() => { setShowAddList(false); setNewListName(``); setNewListEmoji(``) }}>✕</button>
              </div>
            ) : (
              <button className="add-section-btn" style={{ marginTop: `12px` }} onClick={() => setShowAddList(true)}>
                + Nuova lista
              </button>
            )}
            <div className="modal-btns" style={{ marginTop: `16px` }}>
              <button className="btn-primary" onClick={closeListManager}>Fatto</button>
            </div>
          </div>
        </div>
      )}

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
      {moveModal && (() => {
        const movingItem = items.find(i => i.id === moveModal.itemId)
        if (!movingItem) return null
        const currentSub = subsections.find(s => s.id === movingItem.subsection_id)
        const currentSectionId = currentSub?.section_id

        const allSortedSections = [...sections].sort((a, b) => a.position - b.position)
        const grouped = allSortedSections.map(section => ({
          section,
          subs: subsections
            .filter(s => s.section_id === section.id && s.id !== movingItem.subsection_id)
            .sort((a, b) => a.position - b.position),
        })).filter(g => g.subs.length > 0)

        const sameSectionGroup = grouped.find(g => g.section.id === currentSectionId)
        const otherGroups = grouped.filter(g => g.section.id !== currentSectionId)

        return (
          <div className="modal-bg show" onClick={() => setMoveModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>{`Sposta "${movingItem.name}"`}</h2>

              {sameSectionGroup && (
                <>
                  <p className="sub">Stessa categoria</p>
                  <div className="sub-pick-list">
                    {sameSectionGroup.subs.map(target => (
                      <button
                        key={target.id}
                        className="sub-pick-btn"
                        onClick={() => { onMoveItemToSubsection(moveModal.itemId, target.id); setMoveModal(null) }}
                      >
                        {target.name || `(senza nome)`}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {otherGroups.length > 0 && (
                <>
                  <p className="sub">{sameSectionGroup ? `Altre categorie` : `Scegli la destinazione`}</p>
                  {otherGroups.map(({ section, subs }) => (
                    <div key={section.id}>
                      <div className="move-section-label">{section.emoji || `📦`} {section.name}</div>
                      <div className="sub-pick-list">
                        {subs.map(target => (
                          <button
                            key={target.id}
                            className="sub-pick-btn"
                            onClick={() => { onMoveItemToSubsection(moveModal.itemId, target.id); setMoveModal(null) }}
                          >
                            {target.name || `(senza nome)`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div className="modal-btns">
                <button className="btn-ghost" onClick={() => setMoveModal(null)}>Annulla</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Import modal ── */}
      {importRows && (
        <div className="modal-bg show" onClick={() => setImportRows(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Importa lista</h2>
            <p className="sub">
              {`Trovati ${importRows.length} articoli. Hai già ${items.length} articoli nella lista base. Come vuoi procedere?`}
            </p>
            <div className="modal-btns" style={{ flexDirection: `column`, gap: `8px` }}>
              <button
                className="btn-danger-modal"
                onClick={() => { onImportItems(importRows, `overwrite`); setImportRows(null) }}
              >
                Sostituisci la lista esistente
              </button>
              <button
                className="btn-primary"
                onClick={() => { onImportItems(importRows, `add-all`); setImportRows(null) }}
              >
                Aggiungi tutti gli alimenti
              </button>
              <button
                className="btn-primary"
                onClick={() => { onImportItems(importRows, `add-new`); setImportRows(null) }}
              >
                Aggiungi solo i nuovi
              </button>
              <button className="btn-ghost" onClick={() => setImportRows(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {exportToast && (
        <div className="export-toast">Copiato negli appunti ✓</div>
      )}
      {importErrToast && (
        <div className="export-toast">File non valido o vuoto</div>
      )}
    </div>
  )
}
