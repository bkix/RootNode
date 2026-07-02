import { useState } from 'react'
import type { LdapAttribute } from '../types'
import styles from './NewEntryForm.module.css'

interface Props {
  defaultBaseDn?: string
  onCreate: (dn: string, attributes: LdapAttribute[]) => Promise<void> | void
  onClose: () => void
}

function parseAttrs(raw: string): LdapAttribute[] {
  const map: Record<string, string[]> = {}
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const name = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!name || !value) continue
    ;(map[name] ??= []).push(value)
  }
  return Object.entries(map).map(([name, values]) => ({ name, values }))
}

export function NewEntryForm({ defaultBaseDn, onCreate, onClose }: Props) {
  const [rdnAttr, setRdnAttr] = useState('cn')
  const [rdnValue, setRdnValue] = useState('')
  const [baseDn, setBaseDn] = useState(defaultBaseDn ?? '')
  const [rawAttrs, setRawAttrs] = useState('')

  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreate = async () => {
    const dn = `${rdnAttr}=${rdnValue},${baseDn}`
    const attributes = parseAttrs(rawAttrs)
    setCreating(true)
    setCreateError(null)
    try {
      await onCreate(dn, attributes)
      onClose()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.title}>New Entry</div>
        <div className={styles.row}>
          <label className={styles.fieldFlex1}>
            <span className={styles.label}>RDN Attribute</span>
            <input className={styles.input} placeholder="cn" value={rdnAttr} onChange={e => setRdnAttr(e.target.value)} />
          </label>
          <label className={styles.fieldFlex2}>
            <span className={styles.label}>RDN Value</span>
            <input className={styles.input} placeholder="Jane Smith" value={rdnValue} onChange={e => setRdnValue(e.target.value)} />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Base DN</span>
          <input className={styles.inputMono} value={baseDn} onChange={e => setBaseDn(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Attributes (attr: value, one per line)</span>
          <textarea
            className={styles.textarea}
            rows={6}
            placeholder="objectClass: inetOrgPerson"
            value={rawAttrs}
            onChange={e => setRawAttrs(e.target.value)}
          />
        </label>
        <div className={styles.footer}>
          {createError && <div className={styles.error}>{createError}</div>}
          <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
          <button onClick={handleCreate} disabled={creating} className={styles.createBtn}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
