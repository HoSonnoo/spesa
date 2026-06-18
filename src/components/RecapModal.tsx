import type { SessionItem } from '../types'

interface Props {
  sessionItems: SessionItem[]
  createdAt: string
  onClose: () => void
  onNewShopping: () => void
}

export default function RecapModal({ sessionItems, createdAt, onClose, onNewShopping }: Props) {
  const bought = sessionItems.filter(si => si.bought)
  const total = sessionItems.length
  const pct = total > 0 ? Math.round((bought.length / total) * 100) : 0
  const totalSpent = bought.reduce((sum, si) => sum + (si.price ?? 0) * si.quantity, 0)
  const dateStr = new Date(createdAt).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="modal-bg show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2>Spesa completata 🎉</h2>
        <div className="sub">{dateStr}</div>
        <div className="stats">
          <div className="stat">
            <div className="n">{bought.length}</div>
            <div className="l">Comprati</div>
          </div>
          <div className="stat">
            <div className="n">{total}</div>
            <div className="l">In lista</div>
          </div>
          <div className="stat">
            <div className="n">{pct}%</div>
            <div className="l">Completato</div>
          </div>
          {totalSpent > 0 && (
            <div className="stat">
              <div className="n" style={{ fontSize: '20px' }}>{`€ ${totalSpent.toFixed(2)}`}</div>
              <div className="l">Speso</div>
            </div>
          )}
        </div>
        <ul className="recap-list">
          {bought.length > 0
            ? bought.map(si => (
                <li key={si.id}>
                  <span style={{ color: 'var(--green)' }}>✓</span>
                  <span>{si.name}{si.quantity > 1 ? ` ×${si.quantity}` : ''}</span>
                  <span className="cat">{si.section_name}</span>
                </li>
              ))
            : (
                <li style={{ color: 'var(--muted)' }}>
                  Nessun articolo contrassegnato come comprato.
                </li>
              )
          }
        </ul>
        <div className="modal-btns">
          <button className="btn-ghost" onClick={onClose}>Chiudi</button>
          <button className="btn-primary" onClick={onNewShopping}>Nuova spesa</button>
        </div>
      </div>
    </div>
  )
}
