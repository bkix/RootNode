import { useState } from 'react'
import type { SearchScope } from '../types'
import styles from './SearchBar.module.css'

interface Props {
  onSearch: (filter: string, scope: SearchScope, baseDn?: string) => void
  defaultBaseDn?: string
  serverType?: string
  disabled?: boolean
  onToggleTree: () => void
  treeActive?: boolean
}

export function SearchBar({ onSearch, defaultBaseDn, serverType, disabled, onToggleTree, treeActive }: Props) {
  const [filter, setFilter] = useState('')
  const [scope, setScope] = useState<SearchScope>('sub')
  const [baseDn, _setBaseDn] = useState(defaultBaseDn ?? '')

  const handleSearch = () => {
    let f: string
    if (filter.startsWith('(')) {
      f = filter
    } else if (/^[\w-]+=/.test(filter)) {
      f = `(${filter})`
    } else if (serverType === 'ad') {
      f = `(anr=${filter})`
    } else {
      f = `(cn=*${filter}*)`
    }
    onSearch(f, scope, baseDn || undefined)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrap}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.input}
          placeholder="Search: text, cn=John, (mail=*@example.com)"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          disabled={disabled}
        />
      </div>
      <select
        className={styles.select}
        value={scope}
        onChange={e => setScope(e.target.value as SearchScope)}
        disabled={disabled}
      >
        <option value="sub">Subtree</option>
        <option value="one">One-level</option>
        <option value="base">Base</option>
      </select>
      <button
        onClick={handleSearch}
        disabled={disabled}
        className={styles.goBtn}
      >
        Go
      </button>
      <button
        onClick={onToggleTree}
        className={`${styles.treeBtn} ${treeActive ? styles.treeBtnActive : ''}`}
      >
        Tree
      </button>
    </div>
  )
}
