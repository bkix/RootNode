import { useState } from 'react'
import type { LdapAttribute } from '../types'
import styles from './MultiValueModal.module.css'

interface Props {
  attr: LdapAttribute
  onSave: (name: string, values: string[]) => void
  onClose: () => void
}

export function MultiValueModal({ attr, onSave, onClose }: Props) {
  const [values, setValues] = useState<string[]>([...attr.values])
  const [newVal, setNewVal] = useState('')

  const add = () => {
    if (!newVal.trim()) return
    setValues(v => [...v, newVal.trim()])
    setNewVal('')
  }

  const remove = (idx: number) => setValues(v => v.filter((_, i) => i !== idx))

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.attrName}>{attr.name}</div>
        <div className={styles.valuesBox}>
          <div className={styles.valuesHeader}>Values</div>
          {values.map((v, i) => (
            <div key={i} className={styles.valueRow}>
              <span>{v}</span>
              <button onClick={() => remove(i)} className={styles.removeBtn}>✕ Remove</button>
            </div>
          ))}
        </div>
        <div className={styles.addRow}>
          <input
            className={styles.addInput}
            placeholder="Add value…"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button onClick={add} className={styles.addBtn}>Add</button>
        </div>
        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
          <button onClick={() => onSave(attr.name, values)} className={styles.saveBtn}>Save</button>
        </div>
      </div>
    </div>
  )
}
