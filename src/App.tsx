import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import BaseList from './components/BaseList'
import ShoppingHistory from './components/ShoppingHistory'
import ShoppingModal from './components/ShoppingModal'
import RecapModal from './components/RecapModal'
import type { List, Section, Subsection, Item, ShoppingSession as ShoppingSessionType, SessionItem, ImportRow } from './types'

const THEMES = [
  { id: `viola`,   label: `Viola`,   primary: `#7e47ff`, soft: `rgba(126,71,255,0.13)`,  rgb: `126,71,255`  },
  { id: `verde`,   label: `Verde`,   primary: `#2eb86a`, soft: `rgba(46,184,106,0.13)`,  rgb: `46,184,106`  },
  { id: `azzurro`, label: `Azzurro`, primary: `#2b8aef`, soft: `rgba(43,138,239,0.13)`,  rgb: `43,138,239`  },
  { id: `arancio`, label: `Arancio`, primary: `#f5762e`, soft: `rgba(245,118,46,0.13)`,  rgb: `245,118,46`  },
  { id: `rosa`,    label: `Rosa`,    primary: `#e84393`, soft: `rgba(232,67,147,0.13)`,  rgb: `232,67,147`  },
  { id: `rosso`,   label: `Rosso`,   primary: `#ef4444`, soft: `rgba(239,68,68,0.13)`,   rgb: `239,68,68`   },
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [lists, setLists] = useState<List[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [subsections, setSubsections] = useState<Subsection[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const [activeSession, setActiveSession] = useState<ShoppingSessionType | null>(null)
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)

  const [tab, setTab] = useState<'base' | 'history'>('base')
  const [showRecap, setShowRecap] = useState(false)

  const [themeId, setThemeId] = useState(() => localStorage.getItem('theme') ?? 'viola')
  const [showThemePicker, setShowThemePicker] = useState(false)

  const [historySessions, setHistorySessions] = useState<ShoppingSessionType[]>([])
  const [historySessionItems, setHistorySessionItems] = useState<Record<string, SessionItem[]>>({})
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setLists([])
      setActiveListId(null)
      setSections([])
      setSubsections([])
      setItems([])
      setActiveSession(null)
      setSessionItems([])
      setSelectedIds(new Set())
      setShowModal(false)
      setTab('base')
      return
    }
    loadAll()
  }, [user])

  // Realtime sync for session items (multi-device)
  useEffect(() => {
    if (!activeSession) return
    const channel = supabase
      .channel(`session-${activeSession.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_items',
        filter: `session_id=eq.${activeSession.id}`,
      }, payload => {
        const updated = payload.new as SessionItem
        setSessionItems(prev => prev.map(si => si.id === updated.id ? { ...si, ...updated } : si))
      })
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
    document.documentElement.style.setProperty('--primary-rgb', t.rgb)
    localStorage.setItem('theme', themeId)
  }, [themeId])

  // ── List seeding ──────────────────────────────────────────────────────────

  async function seedDefaultLists(userId: string): Promise<List[]> {
    const defaults = [
      { name: `Alimentare`, emoji: `🛒`, position: 0 },
      { name: `Casa`,       emoji: `🏠`, position: 1 },
      { name: `Hobby`,      emoji: `🎯`, position: 2 },
    ]
    const { data } = await supabase
      .from('lists')
      .insert(defaults.map(d => ({ ...d, user_id: userId })))
      .select()
    return (data as List[]) ?? []
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadAll() {
    if (!user) return
    setDataLoading(true)

    const [secRes, subRes, itemRes, listsRes] = await Promise.all([
      supabase.from('sections').select('*').order('position'),
      supabase.from('subsections').select('*').order('position'),
      supabase.from('items').select('*').order('position'),
      supabase.from('lists').select('*').order('position'),
    ])

    if (subRes.data) setSubsections(subRes.data as Subsection[])
    if (itemRes.data) setItems(itemRes.data as Item[])

    // Load or seed lists
    let loadedLists: List[] = (listsRes.data as List[]) ?? []
    if (loadedLists.length === 0) {
      loadedLists = await seedDefaultLists(user.id)
    }
    setLists(loadedLists)

    // Set active list from saved preference or first list
    const savedListId = localStorage.getItem('activeListId')
    const firstValidId = loadedLists.find(l => l.id === savedListId)?.id ?? loadedLists[0]?.id ?? null
    setActiveListId(firstValidId)

    // Auto-migrate sections without list_id → assign to first list
    let loadedSections: Section[] = (secRes.data as Section[]) ?? []
    const orphans = loadedSections.filter(s => !s.list_id)
    if (orphans.length > 0 && loadedLists.length > 0) {
      const firstListId = loadedLists[0].id
      await supabase.from('sections').update({ list_id: firstListId }).is('list_id', null)
      loadedSections = loadedSections.map(s => s.list_id ? s : { ...s, list_id: firstListId })
    }
    setSections(loadedSections)

    // Restore active session (without auto-opening modal)
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
        setSessionItems(sItems as SessionItem[])
        setSelectedIds(new Set(
          sItems
            .map((si: SessionItem) => si.item_id)
            .filter((id): id is string => id !== null)
        ))
      }
    }

    setDataLoading(false)
  }

  function handleSetActiveListId(id: string) {
    setActiveListId(id)
    localStorage.setItem('activeListId', id)
  }

  // ── List management ───────────────────────────────────────────────────────

  async function addList(name: string, emoji: string) {
    if (!user) return
    const position = lists.length > 0 ? Math.max(...lists.map(l => l.position)) + 1 : 0
    const { data } = await supabase
      .from('lists')
      .insert({ user_id: user.id, name, emoji, position })
      .select()
      .single()
    if (data) setLists(prev => [...prev, data as List])
  }

  async function updateList(id: string, name: string, emoji: string) {
    setLists(prev => prev.map(l => l.id === id ? { ...l, name, emoji } : l))
    await supabase.from('lists').update({ name, emoji }).eq('id', id)
  }

  async function deleteList(id: string) {
    if (lists.length <= 1) {
      alert(`Devi avere almeno una lista.`)
      return
    }
    if (!confirm(`Eliminare questa lista e tutti i suoi contenuti?`)) return
    const listSectionIds = sections.filter(s => s.list_id === id).map(s => s.id)
    const listSubIds = subsections.filter(s => listSectionIds.includes(s.section_id)).map(s => s.id)
    const listItemIds = items.filter(i => listSubIds.includes(i.subsection_id)).map(i => i.id)
    await supabase.from('lists').delete().eq('id', id)
    const newLists = lists.filter(l => l.id !== id)
    setLists(newLists)
    setSections(prev => prev.filter(s => s.list_id !== id))
    setSubsections(prev => prev.filter(s => !listSectionIds.includes(s.section_id)))
    setItems(prev => prev.filter(i => !listSubIds.includes(i.subsection_id)))
    setSelectedIds(prev => {
      const n = new Set(prev)
      listItemIds.forEach(x => n.delete(x))
      return n
    })
    if (activeListId === id) {
      const newActiveId = newLists[0]?.id ?? null
      setActiveListId(newActiveId)
      if (newActiveId) localStorage.setItem('activeListId', newActiveId)
      else localStorage.removeItem('activeListId')
    }
  }

  async function reorderLists(activeId: string, overId: string) {
    if (activeId === overId) return
    const sorted = [...lists].sort((a, b) => a.position - b.position)
    const oldIdx = sorted.findIndex(l => l.id === activeId)
    const newIdx = sorted.findIndex(l => l.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updated = reordered.map((l, i) => ({ ...l, position: i }))
    setLists(updated)
    await Promise.all(updated.map(l =>
      supabase.from('lists').update({ position: l.position }).eq('id', l.id)
    ))
  }

  // ── Shopping session ──────────────────────────────────────────────────────

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
      const list = lists.find(l => l.id === sec.list_id)
      const listName = list?.name ?? lists[0]?.name ?? `Alimentare`
      return [{
        session_id: session.id,
        item_id: itemId,
        user_id: user.id,
        name: item.name,
        section_name: sec.name,
        list_name: listName,
        quantity: 1,
      }]
    })

    const { data: inserted } = await supabase
      .from('session_items')
      .insert(sItemsToInsert)
      .select()

    if (inserted) {
      setActiveSession(session as ShoppingSessionType)
      setSessionItems(inserted as SessionItem[])
      setShowModal(true)
    }
  }

  async function addSessionItem(name: string, sectionName: string, listName: string, subsectionId?: string) {
    if (!activeSession || !user) return
    const { data } = await supabase
      .from('session_items')
      .insert({
        session_id: activeSession.id,
        item_id: null,
        user_id: user.id,
        name,
        section_name: sectionName,
        list_name: listName,
        quantity: 1,
        bought: false,
      })
      .select()
      .single()
    if (data) setSessionItems(prev => [...prev, data as SessionItem])

    // Auto-sync to base list if not already present
    const nameNorm = name.trim().toLowerCase()
    const alreadyExists = items.some(i => i.name.toLowerCase() === nameNorm)
    if (!alreadyExists) {
      const matchSection = sections.find(s => s.name === sectionName)
      if (matchSection) {
        let targetSubId = subsectionId
        if (!targetSubId) {
          const sectionSubs = subsections
            .filter(s => s.section_id === matchSection.id)
            .sort((a, b) => a.position - b.position)
          targetSubId = (sectionSubs.find(s => s.name === '') ?? sectionSubs[0])?.id
        }
        if (targetSubId) await addItem(targetSubId, name)
      }
    }
  }

  async function updateSessionItemQuantity(sessionItemId: string, quantity: number) {
    if (quantity < 1) return
    setSessionItems(prev => prev.map(si => si.id === sessionItemId ? { ...si, quantity } : si))
    await supabase.from('session_items').update({ quantity }).eq('id', sessionItemId)
  }

  async function updateSessionItemPrice(sessionItemId: string, price: number) {
    setSessionItems(prev => prev.map(si => si.id === sessionItemId ? { ...si, price } : si))
    await supabase.from('session_items').update({ price }).eq('id', sessionItemId)
  }

  async function fetchSuggestions(): Promise<Array<{ name: string; section_name: string; list_name: string }>> {
    if (!user) return []
    const { data: completed } = await supabase
      .from('shopping_sessions')
      .select('id')
      .eq('status', 'completed')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(20)
    if (!completed || completed.length === 0) return []
    const ids = completed.map((s: { id: string }) => s.id)
    const { data } = await supabase
      .from('session_items')
      .select('name, section_name, list_name')
      .in('session_id', ids)
      .eq('bought', true)
    if (!data) return []
    const freq: Record<string, { name: string; section_name: string; list_name: string; count: number }> = {}
    for (const item of data) {
      const key = item.name.toLowerCase().trim()
      if (freq[key]) { freq[key].count++ }
      else { freq[key] = { name: item.name, section_name: item.section_name, list_name: item.list_name, count: 1 } }
    }
    const current = new Set(sessionItems.map(si => si.name.toLowerCase().trim()))
    return Object.values(freq)
      .filter(s => !current.has(s.name.toLowerCase().trim()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ name, section_name, list_name }) => ({ name, section_name, list_name }))
  }

  async function toggleBought(sessionItemId: string) {
    const si = sessionItems.find(s => s.id === sessionItemId)
    if (!si) return
    if (!si.bought) navigator.vibrate?.(40)
    setSessionItems(prev => prev.map(s => s.id === sessionItemId ? { ...s, bought: !s.bought } : s))
    await supabase.from('session_items').update({ bought: !si.bought }).eq('id', sessionItemId)
  }

  async function completeSession() {
    if (!activeSession) return
    await supabase
      .from('shopping_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', activeSession.id)
    setActiveSession(null)
    setShowModal(false)
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
    setShowModal(false)
  }

  function closeRecap() {
    setShowRecap(false)
    setSessionItems([])
    setSelectedIds(new Set())
  }

  function newShopping() {
    setShowRecap(false)
    setSessionItems([])
    setSelectedIds(new Set())
  }

  // ── History ───────────────────────────────────────────────────────────────

  async function reopenSession(sessionId: string) {
    if (activeSession) {
      if (!confirm(`Hai già una spesa in corso. Vuoi annullarla e riaprire questa?`)) return
      await supabase.from('shopping_sessions').delete().eq('id', activeSession.id)
      setActiveSession(null)
      setSessionItems([])
      setSelectedIds(new Set())
    }

    const { data: session } = await supabase
      .from('shopping_sessions')
      .update({ status: `active`, completed_at: null })
      .eq('id', sessionId)
      .select()
      .single()

    if (!session) return

    const { data: sItems } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at')

    const restoredItems = (sItems ?? []) as SessionItem[]
    setActiveSession(session as ShoppingSessionType)
    setSessionItems(restoredItems)
    setSelectedIds(new Set(
      restoredItems.map(si => si.item_id).filter((id): id is string => id !== null)
    ))
    setHistorySessions(prev => prev.filter(s => s.id !== sessionId))
    setHistorySessionItems(prev => { const n = { ...prev }; delete n[sessionId]; return n })
    setShowModal(true)
  }

  async function deleteHistorySession(sessionId: string) {
    if (!confirm(`Eliminare questa spesa dallo storico?`)) return
    await supabase.from('shopping_sessions').delete().eq('id', sessionId)
    setHistorySessions(prev => prev.filter(s => s.id !== sessionId))
    setHistorySessionItems(prev => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
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

  // ── Item CRUD ─────────────────────────────────────────────────────────────

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

  // ── Section / Subsection CRUD ─────────────────────────────────────────────

  async function addSection(name: string, emoji: string) {
    if (!user || !activeListId) return
    const listSections = sections.filter(s => s.list_id === activeListId)
    const position = listSections.length > 0 ? Math.max(...listSections.map(s => s.position)) + 1 : 0
    const { data: sec } = await supabase
      .from('sections')
      .insert({ user_id: user.id, name, emoji, position, list_id: activeListId })
      .select()
      .single()
    if (!sec) return
    setSections(prev => [...prev, sec as Section])
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
      let targetSub = siblings.find(s => s.name === '')

      if (!targetSub) {
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

  async function importItems(rows: ImportRow[], mode: 'overwrite' | 'add-all' | 'add-new') {
    if (!user || !activeListId) return

    let curSections: Section[] = [...sections]
    let curSubsections: Subsection[] = [...subsections]
    let curItems: Item[] = [...items]

    if (mode === 'overwrite') {
      const listSectIds = curSections.filter(s => s.list_id === activeListId).map(s => s.id)
      const listSubIds = curSubsections.filter(s => listSectIds.includes(s.section_id)).map(s => s.id)
      const listItemIds = curItems.filter(i => listSubIds.includes(i.subsection_id)).map(i => i.id)

      if (listSectIds.length > 0) {
        await supabase.from('sections').delete().in('id', listSectIds)
      }

      curSections = curSections.filter(s => !listSectIds.includes(s.id))
      curSubsections = curSubsections.filter(s => !listSubIds.includes(s.id))
      curItems = curItems.filter(i => !listItemIds.includes(i.id))

      setSections(curSections)
      setSubsections(curSubsections)
      setItems(curItems)
      setSelectedIds(prev => {
        const n = new Set(prev)
        listItemIds.forEach(id => n.delete(id))
        return n
      })
    }

    for (const row of rows) {
      if (mode === 'add-new') {
        const exists = curItems.some(i => i.name.toLowerCase() === row.itemName.toLowerCase())
        if (exists) continue
      }

      // Find or create section within active list
      let section = curSections.find(s => s.name === row.sectionName && s.list_id === activeListId)
      if (!section) {
        const listSects = curSections.filter(s => s.list_id === activeListId)
        const pos = listSects.length > 0 ? Math.max(...listSects.map(s => s.position)) + 1 : 0
        const { data } = await supabase
          .from('sections')
          .insert({ user_id: user.id, name: row.sectionName, emoji: row.emoji || `📦`, position: pos, list_id: activeListId })
          .select()
          .single()
        if (!data) continue
        section = data as Section
        curSections = [...curSections, section]
        setSections(prev => [...prev, section!])
      }

      // Find or create subsection
      let subsection = curSubsections.find(s => s.section_id === section!.id && s.name === row.subsectionName)
      if (!subsection) {
        const subs = curSubsections.filter(s => s.section_id === section!.id)
        const pos = subs.length > 0 ? Math.max(...subs.map(s => s.position)) + 1 : 0
        const { data } = await supabase
          .from('subsections')
          .insert({ section_id: section.id, user_id: user.id, name: row.subsectionName, position: pos })
          .select()
          .single()
        if (!data) continue
        subsection = data as Subsection
        curSubsections = [...curSubsections, subsection]
        setSubsections(prev => [...prev, subsection!])
      }

      // Add item
      const subItems = curItems.filter(i => i.subsection_id === subsection!.id)
      const pos = subItems.length > 0 ? Math.max(...subItems.map(i => i.position)) + 1 : 0
      const { data } = await supabase
        .from('items')
        .insert({ subsection_id: subsection.id, user_id: user.id, name: row.itemName, position: pos })
        .select()
        .single()
      if (data) {
        curItems = [...curItems, data as Item]
        setItems(prev => [...prev, data as Item])
      }
    }
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
    // Only reorder within the active list
    const sorted = [...sections]
      .filter(s => s.list_id === activeListId)
      .sort((a, b) => a.position - b.position)
    const oldIdx = sorted.findIndex(s => s.id === activeId)
    const newIdx = sorted.findIndex(s => s.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, moved)
    const updated = reordered.map((s, i) => ({ ...s, position: i }))
    setSections(prev => prev.map(s => updated.find(u => u.id === s.id) ?? s))
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>
  }

  if (!user) {
    return <Auth />
  }

  const selectedCount = selectedIds.size

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
            onDeleteSession={deleteHistorySession}
            onReopenSession={reopenSession}
          />
        ) : (
          <BaseList
            lists={lists}
            activeListId={activeListId}
            onSetActiveListId={handleSetActiveListId}
            onAddList={addList}
            onUpdateList={updateList}
            onDeleteList={deleteList}
            onReorderLists={reorderLists}
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
            onImportItems={importItems}
          />
        )}
      </main>

      {/* ── FAB ── */}
      <div className="fab-bar">
        {!showModal && !activeSession && selectedCount > 0 && (
          <>
            <button className="fab" onClick={startShopping}>
              {`Inizia la spesa (${selectedCount})`}
            </button>
            <p className="hint">Premi per avviare la sessione di spesa</p>
          </>
        )}
        {!showModal && activeSession && (
          <button className="fab" onClick={() => setShowModal(true)}>
            {`Riprendi la spesa → (${sessionItems.length} articoli)`}
          </button>
        )}
      </div>

      {/* ── Shopping modal ── */}
      <ShoppingModal
        show={showModal}
        sessionItems={sessionItems}
        lists={lists}
        sections={sections}
        subsections={subsections}
        items={items}
        onToggleBought={toggleBought}
        onUpdateQuantity={updateSessionItemQuantity}
        onUpdatePrice={updateSessionItemPrice}
        onAddSessionItem={addSessionItem}
        onCompleteSession={completeSession}
        onClose={() => setShowModal(false)}
        onFetchSuggestions={fetchSuggestions}
      />

      {/* ── Recap modal ── */}
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
