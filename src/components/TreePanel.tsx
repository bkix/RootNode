import { useState, useCallback, useEffect } from 'react'
import styles from './TreePanel.module.css'

const PAGE_SIZE = 100

interface TreeNode {
  dn: string
}

interface Props {
  profileId: string
  rootDn: string
  width?: number
  onBrowse: (dn: string) => void
  onOpen: (dn: string) => void
}

function NodeItem({ node, profileId, onBrowse, onOpen, depth, autoExpand }: {
  node: TreeNode
  profileId: string
  onBrowse: (dn: string) => void
  onOpen: (dn: string) => void
  depth: number
  autoExpand?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<TreeNode[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [fetchSize, setFetchSize] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (size: number) => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await window.api.ldap.search(profileId, {
        filter: '(objectClass=*)',
        scope: 'one',
        baseDn: node.dn,
        pageSize: size,
      }) as { entries: Array<{ dn: string }>; hasMore: boolean }
      setChildren(result.entries.map(e => ({ dn: e.dn })))
      setHasMore(result.hasMore)
      setExpanded(true)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [node.dn, profileId])

  useEffect(() => {
    if (autoExpand) load(PAGE_SIZE)
  }, [autoExpand]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (expanded) {
      setExpanded(false)
    } else if (children.length > 0) {
      setExpanded(true)
    } else {
      load(PAGE_SIZE)
    }
    onBrowse(node.dn)
  }, [expanded, children.length, load, node.dn, onBrowse])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onOpen(node.dn)
  }, [node.dn, onOpen])

  const loadMore = useCallback(async () => {
    const nextSize = fetchSize + PAGE_SIZE
    setFetchSize(nextSize)
    await load(nextSize)
  }, [fetchSize, load])

  const label = node.dn.split(',')[0] ?? node.dn

  return (
    <div>
      <div
        className={styles.nodeRow}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={node.dn}
      >
        <span className={styles.arrow}>
          {loading ? '…' : expanded ? '▾' : '▸'}
        </span>
        <span className={styles.label}>
          {label}
        </span>
      </div>
      {loadError && (
        <div className={styles.error} style={{ paddingLeft: `${(depth + 2) * 12}px` }}>
          {loadError}
        </div>
      )}
      {expanded && (
        <>
          {children.map(c => (
            <NodeItem
              key={c.dn}
              node={c}
              profileId={profileId}
              onBrowse={onBrowse}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))}
          {hasMore && (
            <div style={{ paddingLeft: `${(depth + 2) * 12}px` }}>
              <button
                onClick={e => { e.stopPropagation(); loadMore() }}
                disabled={loading}
                className={styles.loadMore}
              >
                {loading ? 'Loading…' : 'Load more…'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function TreePanel({ profileId, rootDn, onBrowse, onOpen }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        Tree
        <span className={styles.headerHint}>· dbl-click=open</span>
      </div>
      <div className={styles.scrollArea}>
        <NodeItem
          node={{ dn: rootDn }}
          profileId={profileId}
          onBrowse={onBrowse}
          onOpen={onOpen}
          depth={0}
          autoExpand
        />
      </div>
    </div>
  )
}
