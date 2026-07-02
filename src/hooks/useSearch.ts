import { useState, useCallback, useEffect } from 'react'
import type { Entry, SearchOptions } from '../types'

const PAGE_SIZE = 50

export function useSearch(profileId: string | null) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastOpts, setLastOpts] = useState<SearchOptions | null>(null)
  const [page, setPage] = useState(0)

  // Reset all state when switching profiles so stale results/errors don't persist
  useEffect(() => {
    setEntries([])
    setHasMore(false)
    setLoading(false)
    setError(null)
    setLastOpts(null)
    setPage(0)
  }, [profileId])

  const search = useCallback(async (opts: SearchOptions) => {
    if (!profileId) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.ldap.search(profileId, { ...opts, page: 0, pageSize: PAGE_SIZE }) as { entries: Entry[]; hasMore: boolean }
      setEntries(result.entries)
      setHasMore(result.hasMore)
      setLastOpts(opts)
      setPage(0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [profileId])

  const loadMore = useCallback(async () => {
    if (!profileId || !lastOpts) return
    const nextPage = page + 1
    setLoading(true)
    try {
      const result = await window.api.ldap.search(profileId, { ...lastOpts, page: nextPage, pageSize: PAGE_SIZE }) as { entries: Entry[]; hasMore: boolean }
      setEntries(prev => [...prev, ...result.entries])
      setHasMore(result.hasMore)
      setPage(nextPage)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [profileId, lastOpts, page])

  return { entries, hasMore, loading, error, search, loadMore }
}
