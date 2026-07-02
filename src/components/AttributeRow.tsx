import { useState, useRef, useEffect } from 'react'
import type { LdapAttribute } from '../types'
import styles from './AttributeRow.module.css'

interface Props {
  attr: LdapAttribute
  isBool: boolean
  isMulti: boolean
  readOnly?: boolean
  attrColWidth?: number
  onEdit: (name: string, value: string) => void
  onDelete: (name: string) => void
  onOpenModal: (attr: LdapAttribute) => void
}

export function AttributeRow({ attr, isBool, isMulti, readOnly, attrColWidth, onEdit, onDelete, onOpenModal }: Props) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(attr.values[0] ?? '')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true })
  }, [editing])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const commit = () => {
    onEdit(attr.name, draft)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(attr.values[0] ?? '')
    setEditing(false)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const renderValue = () => {
    if (isMulti) {
      const collapsed = !expanded && attr.values.length > 8
      const visibleValues = collapsed ? [] : attr.values
      return (
        <div>
          <div
            className={styles.multiHeader}
            onClick={() => setExpanded(e => !e)}
            title={readOnly ? 'Read-only (server-managed)' : 'Click to expand/collapse, double-click to edit'}
            onDoubleClick={readOnly ? undefined : () => onOpenModal(attr)}
          >
            <span className={styles.multiArrow}>
              {expanded || attr.values.length <= 8 ? '▾' : '▸'}
            </span>
            <span className={styles.multiCount}>
              {attr.values.length} values
            </span>
          </div>
          {(attr.values.length <= 8 || expanded) && (
            <div className={styles.multiValues}>
              {visibleValues.length === 0 ? attr.values.map((v, i) => (
                <div key={i} className={`${styles.multiValue} ${readOnly ? styles.multiValueReadOnly : ''}`} title={v}>{v}</div>
              )) : visibleValues.map((v, i) => (
                <div key={i} className={`${styles.multiValue} ${readOnly ? styles.multiValueReadOnly : ''}`} title={v}>{v}</div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (isBool && !readOnly) {
      return (
        <select
          className={styles.boolSelect}
          value={attr.values[0]}
          onChange={e => onEdit(attr.name, e.target.value)}
        >
          <option value="TRUE">TRUE</option>
          <option value="FALSE">FALSE</option>
        </select>
      )
    }
    if (editing && !readOnly) {
      return (
        <div>
          <input
            ref={inputRef}
            className={styles.editInput}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
            onBlur={commit}
            title="Enter to confirm · Esc to cancel"
          />
        </div>
      )
    }
    const val = attr.values[0] ?? ''
    const isLong = val.length > 80
    return (
      <span
        className={`${styles.valueText} ${expanded ? styles.valueTextExpanded : ''} ${readOnly ? styles.valueTextReadOnly : ''}`}
        onClick={isLong ? () => setExpanded(e => !e) : undefined}
        onDoubleClick={readOnly ? undefined : () => { setDraft(val); setEditing(true) }}
        title={readOnly ? `${val}\n(Read-only — server-managed)` : val}
      >
        {val}
      </span>
    )
  }

  return (
    <div
      className={`${styles.row} ${editing ? styles.rowEditing : ''}`}
      onContextMenu={handleContextMenu}
    >
      <div className={`${styles.attrName} ${readOnly ? styles.attrNameReadOnly : ''}`} style={{ width: attrColWidth ?? 176 }} title={readOnly ? `${attr.name} (read-only)` : attr.name}>
        {attr.name}
      </div>
      <div className={styles.valueCol}>
        {renderValue()}
      </div>
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {readOnly ? (
            <div className={styles.contextReadOnly}>Read-only</div>
          ) : (
            <button
              className={styles.contextDeleteBtn}
              onClick={() => { onDelete(attr.name); setContextMenu(null) }}
            >
              Delete attribute
            </button>
          )}
        </div>
      )}
    </div>
  )
}
