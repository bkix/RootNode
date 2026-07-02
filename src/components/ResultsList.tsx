import { useRef, useEffect } from 'react'
import type { Entry } from '../types'
import styles from './ResultsList.module.css'

const CONTAINER_CLASSES = new Set([
  'organizationalunit', 'container', 'organization', 'domain',
  'country', 'locality', 'builtindomain', 'domaindns',
])

function isContainer(entry: Entry): boolean {
  const oc = entry.attributes.find(a => a.name.toLowerCase() === 'objectclass')
  if (!oc) return false
  return oc.values.some(v => CONTAINER_CLASSES.has(v.toLowerCase()))
}

interface Props {
  entries: Entry[]
  hasMore: boolean
  loading: boolean
  error: string | null
  selectedDn: string | null
  onSelect: (entry: Entry) => void
  onBrowse: (dn: string) => void
  onLoadMore: () => void
  onNewEntry: () => void
}

function getEntryLabel(entry: Entry): { label: string; parent: string } {
  const cnAttr = entry.attributes.find(a => a.name.toLowerCase() === 'cn')
  const parts = entry.dn.split(',')
  const label = cnAttr?.values[0] ?? parts[0] ?? entry.dn
  const parent = parts.slice(1).join(',')
  return { label, parent }
}

export function ResultsList({ entries, hasMore, loading, error, selectedDn, onSelect, onBrowse, onLoadMore, onNewEntry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(loading)
  const hasMoreRef = useRef(hasMore)
  loadingRef.current = loading
  hasMoreRef.current = hasMore

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver((observed) => {
      if (observed[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
        onLoadMore()
      }
    }, { root: scrollRef.current, threshold: 0 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.status}>
          {loading && <span className={styles.spinner} />}
          {entries.length} result{entries.length !== 1 ? 's' : ''}
        </span>
        <button onClick={onNewEntry} className={styles.newBtn} title="New entry">+ New</button>
      </div>
      <div ref={scrollRef} className={styles.scrollArea}>
        {error && (
          <div className={styles.error}>{error}</div>
        )}
        {entries.map(entry => {
          const { label, parent } = getEntryLabel(entry)
          const container = isContainer(entry)
          return (
            <div
              key={entry.dn}
              onClick={() => container ? onBrowse(entry.dn) : onSelect(entry)}
              onDoubleClick={() => { if (container) onSelect(entry) }}
              className={`${styles.entry} ${selectedDn === entry.dn ? styles.entrySelected : ''}`}
            >
              <div className={styles.entryLabel}>
                {container && <span className={styles.folderIcon}>📁</span>}
                {label}
              </div>
              <div className={styles.entryParent}>{parent}</div>
            </div>
          )
        })}
        <div ref={sentinelRef} className={styles.sentinel} />
        {loading && entries.length === 0 && (
          <div className={styles.loadingText}>Searching…</div>
        )}
        {loading && entries.length > 0 && (
          <div className={styles.loadingMore}>Loading more…</div>
        )}
      </div>
    </div>
  )
}
