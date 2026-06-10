import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import BaseList from './components/BaseList'
import ShoppingSession from './components/ShoppingSession'
import ShoppingHistory from './components/ShoppingHistory'
import RecapModal from './components/RecapModal'
import type { Section, Subsection, Item, ShoppingSession as ShoppingSessionType, SessionItem } from './types'

const THEMES = [
  { id: `viola`,   label: `Viola`,   primary: `#7e47ff`, soft: `rgba(126,71,255,0.13)` },
  { id: `verde`,   label: `Verde`,   primary: `#2eb86a`, soft: `rgba(46,184,106,0.13)` },
  { id: `azzurro`, label: `Azzurro`, primary: `#2b8aef`, soft: `rgba(43,138,239,0.13)` },
  { id: `arancio`, label: `Arancio`, primary: `#f5762e`, soft: `rgba(245,118,46,0.13)` },
  { id: `rosa`,    label: `Rosa`,    primary: `#e84393`, soft: `rgba(232,67,147,0.13)` },
  { id: `rosso`,   label: `Rosso`,   primary: `#ef4444`, soft: `rgba(239,68,68,0.13)` },
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [sections, setSections] = useState<Section[]>([])
  const [subsections, setSubsections] = useState<Subsection[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [activeSession, setActiveSession] = useState<ShoppingSessionType | null>(null)
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [tab, setTab] = useState<'base' | 'session' | 'history'>('base')
  const [showRecap, setShowRecap] = useState(false)

  const [themeId, setThemeId] = useState(() => localStorage.getItem('theme') ?? 'viola')
  const [showThemePicker, setShowThemePicker] = useState(false)

  const [historySessions, setHistorySessions] = useState<ShoppingSessionType[]>([])
  const [historySessionItems, setHistorySessionItems] = useState<Record<string, SessionItem[]>>({})
  const [historyLoading, setHistoryLoading] = useState(false)

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data on login, clear on logout
  useEffect(() => {
    if (!user) {
      setSections([])
      setSubsections([])
      setItems([])
      setActiveSession(null)
      setSessionItems([])
      setSelectedIds(new Set())
      setTab('base')
      return
    }
    loadAll()
  }, [user])

  // Realtime subscription for session_items (multi-device sync)
  useEffect(() => {
    if (!activeSession) return

    const channel = supabase
      .channel(`session-${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_items',
          filter: `session_id=eq.${activeSession.id}`,
        },
        payload => {
          const updated = payload.new as SessionItem
          setSessionItems(prev => prev.map(si => si.id === updated.id ? { ...si, ...updated } : si))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSession?.id])

  useEffect(() => {
    if (tab === 'history' && user) loadHistory()
  }, [tab, user])

  useEffect(() => {
    const t = THEMES.find(t => t.id === themeId) ?? THEMES[0]
    document.documentElement.style.setProperty('--primary', t.primary)
    document.documentElement.style.setProperty('--primary-soft', t.soft)
    localStorage.setItem('theme', themeId)
  }, [themeId])

  async function loadAll() {
    setDataLoading(true)

    const [secRes, subRes, itemRes] = await Promise.all([
      supabase.from('sections').select('*').order('position'),
      supabase.from('subsections').select('*').order('position'),
      supabase.from('items').select('*').order('position'),
    ])

    if (secRes.data) setSections(secRes.data)
    if (subRes.data) setSubsections(subRes.data)
    if (itemRes.data) setItems(itemRes.data)

    // Restore active session if one exists
    const { data: sessions } = await supabase
      .from('shopping_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    if (sessions && sessions.length > 0) {
      const session = sessions[0] as ShoppingSessionType
      setActiveSession(session)

      const { data: sItems } = await supabase
        .from('session_items')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at')

      if (sItems) {
        setSessionItems(sItems)
        const ids = new Set(
          sItems
            .map((si: SessionItem) => si.item_id)
            .filter((id): id is string => id !== null)
        )
        setSelectedIds(ids)
      }
      setTab('session')
    }

    setDataLoading(false)
  }

  function toggleSelect(itemId: string) {
    if (activeSession) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function startShopping() {
    if (!user || selectedIds.size === 0) return

    const { data: session, error } = await supabase
      .from('shopping_sessions')
      .insert({ user_id: user.id, status: 'active' })
      .select()
      .single()

    if (error || !session) return

    const sItemsToInsert = Array.from(selectedIds).flatMap(itemId => {
      const item = items.find(i => i.id === itemId)
      if (!item) return []
      const sub = subsections.find(s => s.id === item.subsection_id)
      if (!sub) return []
      const sec = sections.find(s => s.id === sub.section_id)
      if (!sec) return []
      return [{
        session_id: session.id,
        item_id: itemId,
        user_id: user.id,
        name: item.name,
        section_name: sec.name,
        quantity: 1,
      }]
    })

    const { data: inserted } = await supabase
      .from('session_items')
      .insert(sItemsToInsert)
      .select()

    if (inserted) {
      setActiveSession(session as ShoppingSessionType)
      setSessionItems(inserted)
      setTab('session')
    }
  }

  async function addSessionItem(name: string, sectionName: string) {
    if (!activeSession || !user) return
    const { data } = await supabase
      .from('session_items')
      .insert({
        session_id: activeSession.id,
        item_id: null,
        user_id: user.id,
        name,
        section_name: sectionName,
        quantity: 1,
        bought: false,
      })
      .select()
      .single()
    if (data) setSessionItems(prev => [...prev, data as SessionItem])
  }

  async function updateSessionItemQuantity(sessionItemId: string, quantity: number) {
    if (quantity < 1) return
    setSessionItems(prev => prev.map(si => si.id === sessionItemId ? { ...si, quantity } : si))
    await supabase.from('session_items').update({ quantity }).eq('id', sessionItemId)
  }

  async function loadHistory() {
    if (!user) return
    setHistoryLoading(true)
    const { data: sessions } = await supabase
      .from('shopping_sessions')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
      setHistorySessions([])
      setHistorySessionItems({})
      setHistoryLoading(false)
      return
    }

    setHistorySessions(sessions as ShoppingSessionType[])

    const sessionIds = sessions.map((s: ShoppingSessionType) => s.id)
    const { data: allItems } = await supabase
      .from('session_items')
      .select('*')
      .in('session_id', sessionIds)

    if (allItems) {
      const grouped: Record<string, SessionItem[]> = {}
      for (const item of allItems) {
        if (!grouped[item.session_id]) grouped[item.session_id] = []
        grouped[item.session_id].push(item as SessionItem)
      }
      setHistorySessionItems(grouped)
    }

    setHistoryLoading(false)
  }

  async function toggleBought(sessionItemId: string) {
    const si = sessionItems.find(s => s.id === sessionItemId)
    if (!si) return
    if (!si.bought) navigator.vibrate?.(40)
    // Optimistic update
    setSessionItems(prev => prev.map(s => s.id === sessionItemId ? { ...s, bought: !s.bought } : s))
    await supabase
      .from('session_items')
      .update({ bought: !si.bought })
      .eq('id', sessionItemId)
  }

  async function completeSession() {
    if (!activeSession) return
    await supabase
      .from('shopping_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', activeSession.id)
    setActiveSession(null)
    setShowRecap(true)
  }

  async function resetAll() {
    if (activeSession) {
      if (!confirm(`Annullare la spesa in corso e azzerare la selezione?`)) return
      await supabase.from('shopping_sessions').delete().eq('id', activeSession.id)
      setActiveSession(null)
      setSessionItems([])
    }
    setSelectedIds(new Set())
    setTab('base')
  }

  function closeRecap() {
    setShowRecap(false)
    setSessionItems([])
    setSelectedIds(new Set())
    setTab('base')
  }

  function newShopping() {
    setShowRecap(false)
    setSessionItems([])
    setSelectedIds(new Set())
    setTab('base')
  }

  // ── Item CRUD ──

  async function addItem(subsectionId: string, name: string) {
    if (!user) return
    const existing = items.filter(i => i.subsection_id === subsectionId)
    const position = existing.length > 0 ? Math.max(...existing.map(i => i.position)) + 1 : 0
    const { data } = await supabase
      .from('items')
      .insert({ subsection_id: subsectionId, user_id: user.id, name, position })
      .select()
      .single()
    if (data) setItems(prev => [...prev, data as Item])
  }

  async function updateItem(itemId: string, name: string) {
    const { data } = await supabase
      .from('items')
      .update({ name })
      .eq('id', itemId)
      .select()
      .single()
    if (data) setItems(prev => prev.map(i => i.id === itemId ? data as Item : i))
  }

  async function deleteItem(itemId: string) {
    await supabase.from('items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
  }

  async function reorderItems(activeId: string, overId: string) {
    if (activeId === overId) return
    const item = items.find(i => i.id === activeId)
    if (!item) return
    const siblings = [...items]
      .filter(i => i.subsection_id === item.subsection_id)
      .sort((a, b) => a.position - b.position)
    const oldIdx = siblings.findIndex(i => i.id === activeId)
    const newIdx = siblings.findIndex(i => i.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...siblings]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updated = reordered.map((it, i) => ({ ...it, position: i }))
    setItems(prev => prev.map(i => updated.find(u => u.id === i.id) ?? i))
    await Promise.all(updated.map(it =>
      supabase.from('items').update({ position: it.position }).eq('id', it.id)
    ))
  }

  // ── Section / Subsection CRUD ──

  async function addSection(name: string, emoji: string) {
    if (!user) return
    const position = sections.length > 0 ? Math.max(...sections.map(s => s.position)) + 1 : 0
    const { data: sec } = await supabase
      .from('sections')
      .insert({ user_id: user.id, name, emoji, position })
      .select()
      .single()
    if (!sec) return
    setSections(prev => [...prev, sec as Section])
    // Create a default empty subsection so items can be added immediately
    const { data: sub } = await supabase
      .from('subsections')
      .insert({ section_id: sec.id, user_id: user.id, name: '', position: 0 })
      .select()
      .single()
    if (sub) setSubsections(prev => [...prev, sub as Subsection])
  }

  async function addSubsection(sectionId: string, name: string) {
    if (!user) return
    const existing = subsections.filter(s => s.section_id === sectionId)
    const position = existing.length > 0 ? Math.max(...existing.map(s => s.position)) + 1 : 0
    const { data } = await supabase
      .from('subsections')
      .insert({ section_id: sectionId, user_id: user.id, name, position })
      .select()
      .single()
    if (!data) return

    // Remove the default empty subsection if it exists and has no items
    const emptyDefault = subsections.find(s => s.section_id === sectionId && s.name === '')
    if (emptyDefault) {
      const hasItems = items.some(i => i.subsection_id === emptyDefault.id)
      if (!hasItems) {
        await supabase.from('subsections').delete().eq('id', emptyDefault.id)
        setSubsections(prev => [...prev.filter(s => s.id !== emptyDefault.id), data as Subsection])
        return
      }
    }
    setSubsections(prev => [...prev, data as Subsection])
  }

  async function deleteSection(sectionId: string) {
    if (!confirm(`Eliminare la categoria e tutti i suoi contenuti?`)) return
    const removedSubIds = subsections
      .filter(s => s.section_id === sectionId)
      .map(s => s.id)
    const removedItemIds = items
      .filter(i => removedSubIds.includes(i.subsection_id))
      .map(i => i.id)
    await supabase.from('sections').delete().eq('id', sectionId)
    setSections(prev => prev.filter(s => s.id !== sectionId))
    setSubsections(prev => prev.filter(s => s.section_id !== sectionId))
    setItems(prev => prev.filter(i => !removedSubIds.includes(i.subsection_id)))
    setSelectedIds(prev => {
      const n = new Set(prev)
      removedItemIds.forEach(id => n.delete(id))
      return n
    })
  }

  async function deleteSubsection(subsectionId: string) {
    await supabase.from('subsections').delete().eq('id', subsectionId)
    setSubsections(prev => prev.filter(s => s.id !== subsectionId))
    setItems(prev => prev.filter(i => i.subsection_id !== subsectionId))
  }

  async function deleteSubsectionWithChoice(subsectionId: string, idsToDelete: string[]) {
    const sub = subsections.find(s => s.id === subsectionId)
    if (!sub) return

    const subItems = items.filter(i => i.subsection_id === subsectionId)
    const idsToMove = subItems.filter(i => !idsToDelete.includes(i.id)).map(i => i.id)

    if (idsToMove.length > 0) {
      const siblings = subsections.filter(s => s.section_id === sub.section_id && s.id !== subsectionId)

      // Cerca la sottocategoria senza nome (default) della sezione padre
      let targetSub = siblings.find(s => s.name === '')

      if (!targetSub) {
        // Sposta tutte le sottocategorie esistenti di una posizione per fare spazio in cima
        const shifted = siblings.map(s => ({ ...s, position: s.position + 1 }))
        if (shifted.length > 0) {
          await Promise.all(shifted.map(s =>
            supabase.from('subsections').update({ position: s.position }).eq('id', s.id)
          ))
          setSubsections(prev => prev.map(s => shifted.find(u => u.id === s.id) ?? s))
        }
        const { data } = await supabase
          .from('subsections')
          .insert({ section_id: sub.section_id, user_id: user!.id, name: '', position: 0 })
          .select()
          .single()
        if (data) {
          targetSub = data as Subsection
          setSubsections(prev => [...prev, targetSub!])
        }
      }

      if (targetSub) {
        // Sposta gli articoli esistenti in targetSub per fare spazio in cima
        const existingInTarget = items.filter(i => i.subsection_id === targetSub!.id)
        if (existingInTarget.length > 0) {
          await Promise.all(existingInTarget.map(i =>
            supabase.from('items').update({ position: i.position + idsToMove.length }).eq('id', i.id)
          ))
          setItems(prev => prev.map(i =>
            existingInTarget.some(e => e.id === i.id)
              ? { ...i, position: i.position + idsToMove.length }
              : i
          ))
        }
        // Inserisce gli articoli spostati all'inizio (posizioni 0, 1, 2…)
        await Promise.all(
          idsToMove.map((id, idx) =>
            supabase.from('items').update({ subsection_id: targetSub!.id, position: idx }).eq('id', id)
          )
        )
        setItems(prev => prev.map(item => {
          const idx = idsToMove.indexOf(item.id)
          if (idx === -1) return item
          return { ...item, subsection_id: targetSub!.id, position: idx }
        }))
      }
    }

    if (idsToDelete.length > 0) {
      await supabase.from('items').delete().in('id', idsToDelete)
      setItems(prev => prev.filter(i => !idsToDelete.includes(i.id)))
      setSelectedIds(prev => {
        const n = new Set(prev)
        idsToDelete.forEach(id => n.delete(id))
        return n
      })
    }

    await supabase.from('subsections').delete().eq('id', subsectionId)
    setSubsections(prev => prev.filter(s => s.id !== subsectionId))
  }

  async function moveItemToSubsection(itemId: string, targetSubsectionId: string, newIndex = -1) {
    const item = items.find(i => i.id === itemId)
    if (!item || item.subsection_id === targetSubsectionId) return
    const targetItems = [...items]
      .filter(i => i.subsection_id === targetSubsectionId)
      .sort((a, b) => a.position - b.position)
    const insertAt = newIndex >= 0 ? newIndex : targetItems.length
    const reordered = [...targetItems]
    reordered.splice(insertAt, 0, item)
    const updates = reordered.map((it, idx) => ({ id: it.id, subsection_id: targetSubsectionId, position: idx }))
    setItems(prev => prev.map(i => {
      const u = updates.find(u => u.id === i.id)
      return u ? { ...i, subsection_id: u.subsection_id, position: u.position } : i
    }))
    await Promise.all(updates.map(u =>
      supabase.from('items').update({ subsection_id: u.subsection_id, position: u.position }).eq('id', u.id)
    ))
  }

  async function reorderSections(activeId: string, overId: string) {
    if (activeId === overId) return
    const sorted = [...sections].sort((a, b) => a.position - b.position)
    const oldIdx = sorted.findIndex(s => s.id === activeId)
    const newIdx = sorted.findIndex(s => s.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updated = reordered.map((s, i) => ({ ...s, position: i }))
    setSections(updated)
    await Promise.all(updated.map(s =>
      supabase.from('sections').update({ position: s.position }).eq('id', s.id)
    ))
  }

  async function reorderSubsections(activeId: string, overId: string) {
    if (activeId === overId) return
    const sub = subsections.find(s => s.id === activeId)
    if (!sub) return
    const siblings = [...subsections]
      .filter(s => s.section_id === sub.section_id)
      .sort((a, b) => a.position - b.position)
    const oldIdx = siblings.findIndex(s => s.id === activeId)
    const newIdx = siblings.findIndex(s => s.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...siblings]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updated = reordered.map((s, i) => ({ ...s, position: i }))
    setSubsections(prev => prev.map(s => updated.find(u => u.id === s.id) ?? s))
    await Promise.all(updated.map(s =>
      supabase.from('subsections').update({ position: s.position }).eq('id', s.id)
    ))
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  if (authLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  if (!user) {
    return <Auth />
  }

  const selectedCount = selectedIds.size
  const boughtCount = sessionItems.filter(si => si.bought).length

  return (
    <div className="app">
      <header>
        <div className="title-row">
          <h1>🛒 Spesa</h1>
          <div className="header-actions">
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setShowThemePicker(p => !p)} title="Tema colore">🎨</button>
              {showThemePicker && (
                <div className="theme-picker">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      className={`theme-dot${themeId === t.id ? ' active' : ''}`}
                      style={{ '--dot-color': t.primary } as React.CSSProperties}
                      onClick={() => { setThemeId(t.id); setShowThemePicker(false) }}
                      title={t.label}
                    />
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={resetAll} title="Azzera selezione">↺</button>
            <button className="icon-btn" onClick={logout} title="Esci">⎋</button>
          </div>
        </div>
        <div className="tabs">
          <button
            className={`tab${tab === 'base' ? ' active' : ''}`}
            onClick={() => setTab('base')}
          >
            Lista base
          </button>
          <button
            className={`tab${tab === 'session' ? ' active' : ''}`}
            onClick={() => setTab('session')}
          >
            Da comprare{' '}
            <span className="badge">
              {activeSession ? sessionItems.length : selectedCount}
            </span>
          </button>
          <button
            className={`tab${tab === 'history' ? ' active' : ''}`}
            onClick={() => setTab('history')}
          >
            Storico
          </button>
        </div>
      </header>

      <main>
        {dataLoading ? (
          <div className="empty">Caricamento…</div>
        ) : tab === 'history' ? (
          <ShoppingHistory
            sessions={historySessions}
            sessionItems={historySessionItems}
            loading={historyLoading}
          />
        ) : tab === 'base' ? (
          <BaseList
            sections={sections}
            subsections={subsections}
            items={items}
            selectedIds={selectedIds}
            sessionActive={!!activeSession}
            onToggleSelect={toggleSelect}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onReorderItems={reorderItems}
            onAddSection={addSection}
            onAddSubsection={addSubsection}
            onDeleteSection={deleteSection}
            onDeleteSubsection={deleteSubsection}
            onDeleteSubsectionWithChoice={deleteSubsectionWithChoice}
            onMoveItemToSubsection={moveItemToSubsection}
            onReorderSections={reorderSections}
            onReorderSubsections={reorderSubsections}
          />
        ) : (
          <ShoppingSession
            sessionItems={sessionItems}
            onToggleBought={toggleBought}
            onUpdateQuantity={updateSessionItemQuantity}
            onAddSessionItem={addSessionItem}
          />
        )}
      </main>

      <div className="fab-bar">
        {tab === 'base' && !activeSession && (
          <>
            <button
              className="fab"
              disabled={selectedCount === 0}
              onClick={startShopping}
            >
              {`Inizia la spesa (${selectedCount})`}
            </button>
            {selectedCount > 0 && (
              <p className="hint">Premi per avviare la sessione di spesa</p>
            )}
          </>
        )}
        {tab === 'base' && activeSession && (
          <button className="fab" onClick={() => setTab('session')}>
            {`Vai alla spesa → (${sessionItems.length} articoli)`}
          </button>
        )}
        {tab === 'session' && activeSession && (
          <button className="fab green" onClick={completeSession}>
            {`Completa spesa (${boughtCount}/${sessionItems.length})`}
          </button>
        )}
      </div>

      {showRecap && (
        <RecapModal
          sessionItems={sessionItems}
          createdAt={new Date().toISOString()}
          onClose={closeRecap}
          onNewShopping={newShopping}
        />
      )}
    </div>
  )
}
