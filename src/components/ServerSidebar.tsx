import { useState } from 'react'
import type { Profile } from '../types'
import styles from './ServerSidebar.module.css'

interface Props {
  profiles: Profile[]
  connectedIds: Set<string>
  activeProfileId: string | null
  theme: 'light' | 'system'
  width: number
  serverTypes: Record<string, string>
  onSelect: (id: string) => void
  onAdd: () => void
  onEdit: (profile: Profile) => void
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onToggleTheme: () => void
}

function serverTypeLabel(type: string): string {
  switch (type) {
    case 'ad': return 'Active Directory'
    case 'openldap': return 'OpenLDAP'
    case 'unknown': return 'Unknown'
    default: return type
  }
}

function serverTypeBadgeClass(type: string): string {
  switch (type) {
    case 'ad': return styles.badgeAd
    case 'openldap': return styles.badgeOpenldap
    default: return styles.badgeUnknown
  }
}

export function ServerSidebar({
  profiles, connectedIds, activeProfileId, theme, width, serverTypes,
  onSelect, onAdd, onEdit, onConnect, onDisconnect, onToggleTheme,
}: Props) {
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null)

  return (
    <div className={styles.container} style={{ width }}>
      <div className={styles.header}>
        Servers
      </div>
      <div className={styles.list}>
        {profiles.map(p => {
          const isConnected = connectedIds.has(p.id)
          return (
            <div
              key={p.id}
              className={`${styles.item} ${activeProfileId === p.id ? styles.itemActive : ''}`}
              onClick={() => onSelect(p.id)}
              onDoubleClick={() => onEdit(p)}
              onMouseEnter={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ id: p.id, x: rect.right + 8, y: rect.top + rect.height / 2 })
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className={`${styles.dot} ${isConnected ? styles.dotConnected : ''}`} />
              <span className={styles.itemName}>{p.name}</span>
              <button
                onClick={e => { e.stopPropagation(); isConnected ? onDisconnect(p.id) : onConnect(p.id) }}
                className={isConnected ? styles.disconnectBtn : styles.connectBtn}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          )
        })}
      </div>
      <div className={styles.footer}>
        <button onClick={onAdd} className={styles.addBtn}>
          + Add Server
        </button>
        <button
          onClick={onToggleTheme}
          className={styles.themeBtn}
          title={theme === 'light' ? 'Switch to system theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? '☀ Light' : '◐ System'}
        </button>
      </div>
      {tooltip && connectedIds.has(tooltip.id) && serverTypes[tooltip.id] && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          <span className={serverTypeBadgeClass(serverTypes[tooltip.id])}>
            {serverTypeLabel(serverTypes[tooltip.id])}
          </span>
        </div>
      )}
    </div>
  )
}
