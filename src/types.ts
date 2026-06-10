export interface Section {
  id: string
  user_id: string
  name: string
  emoji: string
  position: number
  created_at: string
}

export interface Subsection {
  id: string
  section_id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export interface Item {
  id: string
  subsection_id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export interface ShoppingSession {
  id: string
  user_id: string
  status: 'active' | 'completed'
  created_at: string
  completed_at: string | null
}

export interface SessionItem {
  id: string
  session_id: string
  item_id: string | null
  user_id: string
  name: string
  section_name: string
  quantity: number
  bought: boolean
  created_at: string
}
