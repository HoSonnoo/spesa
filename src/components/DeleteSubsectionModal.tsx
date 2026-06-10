import { useState } from 'react'
import type { Item } from '../types'

interface Props {
  items: Item[]
  onConfirm: (idsToDelete: string[]) => void
  onCancel: () => void
}

export default function DeleteSubsectionModal({ items, onConfirm, onCancel }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checked.size === items.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(items.map(i => i.id)))
    }
  }

  const allChecked = checked.size === items.length
  const noneChecked = checked.size === 0

  return (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Elimina sottocategoria</h2>
        <p className="sub">
          Seleziona gli articoli da eliminare. Gli altri verranno spostati nella categoria principale.
        </p>

        <div className="checklist-toolbar">
          <label className="check-row check-row--all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
            />
            <span>{allChecked ? `Deseleziona tutti` : `Seleziona tutti`}</span>
          </label>
        </div>

        <div className="item-checklist">
          {items.map(item => (
            <label key={item.id} className="check-row">
              <input
                type="checkbox"
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>

        <div className="modal-btns">
          <button className="btn-ghost" onClick={onCancel}>Annulla</button>
          <button
            className={noneChecked ? `btn-primary` : `btn-danger-modal`}
            onClick={() => onConfirm(Array.from(checked))}
          >
            {noneChecked
              ? `Sposta tutto`
              : checked.size === items.length
                ? `Elimina tutto`
                : `Elimina ${checked.size} e sposta gli altri`}
          </button>
        </div>
      </div>
    </div>
  )
}
