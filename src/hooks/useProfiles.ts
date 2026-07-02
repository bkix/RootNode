import { useState, useEffect, useCallback } from 'react'
import type { Profile } from '../types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const list = await window.api.profiles.list() as Profile[]
      setProfiles(list)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const save = async (profile: Profile) => {
    setError(null)
    try {
      await window.api.profiles.save(profile)
      await refresh()
    } catch (err) {
      setError(String(err))
    }
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      if (connectedIds.has(id)) {
        await window.api.ldap.disconnect(id)
      }
      await window.api.profiles.delete(id)
      setConnectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
      await refresh()
    } catch (err) {
      setError(String(err))
    }
  }

  const connect = async (profileId: string) => {
    setError(null)
    try {
      await window.api.ldap.connect(profileId)
      setConnectedIds(prev => new Set(prev).add(profileId))
    } catch (err) {
      setError(String(err))
      throw err
    }
  }

  const disconnect = async (profileId: string) => {
    setError(null)
    try {
      await window.api.ldap.disconnect(profileId)
      setConnectedIds(prev => { const s = new Set(prev); s.delete(profileId); return s })
    } catch (err) {
      setError(String(err))
    }
  }

  const clearError = () => setError(null)

  return { profiles, connectedIds, save, remove, connect, disconnect, refresh, error, clearError }
}
