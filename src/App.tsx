import { useState, useEffect, useRef, useCallback } from 'react'
import { ServerSidebar } from './components/ServerSidebar'
import { ProfileForm } from './components/ProfileForm'
import { ResizeHandle } from './components/ResizeHandle'
import { ReauthModal } from './components/ReauthModal'
import { useProfiles } from './hooks/useProfiles'
import { SearchBar } from './components/SearchBar'
import { ResultsList } from './components/ResultsList'
import { useSearch } from './hooks/useSearch'
import { EntryDetail } from './components/EntryDetail'
import type { Profile, Entry, LdapAttribute, LdapChange } from './types'
import { MultiValueModal } from './components/MultiValueModal'
import { NewEntryForm } from './components/NewEntryForm'
import { TreePanel } from './components/TreePanel'
import { BreadcrumbBar } from './components/BreadcrumbBar'
import { AboutModal, useAboutModal } from './components/AboutModal'
import appIcon from '../assets/icon.png'
import styles from './App.module.css'

export default function App() {
  const { profiles, connectedIds, save, remove, connect, disconnect, refresh } = useProfiles()
  const { showAbout, setShowAbout } = useAboutModal()
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [theme, setTheme] = useState<'light' | 'system'>(() =>
    (localStorage.getItem('theme') as 'light' | 'system') ?? 'system'
  )

  useEffect(() => {
    localStorage.setItem('theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('light', !isDark)
    }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('light', !e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])
  const [reauthProfile, setReauthProfile] = useState<Profile | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [multiModalAttr, setMultiModalAttr] = useState<LdapAttribute | null>(null)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [showTree, setShowTree] = useState(false)
  const [detectedBaseDns, setDetectedBaseDns] = useState<Record<string, string>>({})
  const [serverTypes, setServerTypes] = useState<Record<string, string>>({})
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [browsePath, setBrowsePath] = useState<string[]>([])
  const [sidebarWidth, setSidebarWidth] = useState(176)
  const [browseWidth, setBrowseWidth] = useState(320)
  const [treeHeight, setTreeHeight] = useState(250)
  const [attrColWidth, _setAttrColWidth] = useState(176)

  const dirtyRef = useRef(false)
  const saveRef = useRef<(() => Promise<void>) | null>(null)

  const handleSelectEntry = useCallback((entry: Entry) => {
    if (selectedEntry && entry.dn !== selectedEntry.dn && dirtyRef.current) {
      setPendingEntry(entry)
    } else {
      setSelectedEntry(entry)
    }
  }, [selectedEntry])
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null
  const activeBaseDn = activeProfile?.baseDn || (activeProfileId ? detectedBaseDns[activeProfileId] : undefined)
  const activeServerType = activeProfileId ? serverTypes[activeProfileId] ?? 'unknown' : 'unknown'

  useEffect(() => {
    for (const profileId of connectedIds) {
      if (!detectedBaseDns[profileId]) {
        window.api.ldap.getDetectedBaseDn(profileId).then((dn: string | null) => {
          if (dn) setDetectedBaseDns(prev => ({ ...prev, [profileId]: dn }))
        }).catch(() => {})
      }
      if (!serverTypes[profileId]) {
        window.api.ldap.getServerType(profileId).then((type: string) => {
          setServerTypes(prev => ({ ...prev, [profileId]: type }))
        }).catch(() => {})
      }
    }
  }, [connectedIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const { entries, hasMore, loading, error: searchError, search, loadMore } = useSearch(activeProfileId)

  const handleSaveProfile = async (profile: Profile, password?: string) => {
    await save(profile)
    if (password) await window.api.keychain.setPassword(profile.id, password)
  }

  const handleConnect = async (profileId: string) => {
    setActiveProfileId(profileId)
    setConnectionError(null)
    setDetectedBaseDns(prev => { const n = { ...prev }; delete n[profileId]; return n })
    setServerTypes(prev => { const n = { ...prev }; delete n[profileId]; return n })
    setBrowsePath([])
    try {
      await connect(profileId)
      const detected = await window.api.ldap.getDetectedBaseDn(profileId) as string | null
      if (detected) setDetectedBaseDns(prev => ({ ...prev, [profileId]: detected }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/\b49\b/.test(msg) || msg.toLowerCase().includes('invalidcredentials')) {
        const profile = profiles.find(p => p.id === profileId)
        if (profile?.bindMethod === 'simple') setReauthProfile(profile)
      } else {
        setConnectionError(msg)
      }
    }
  }

  const [pendingProfileSwitch, setPendingProfileSwitch] = useState<string | null>(null)

  const handleSelect = (profileId: string) => {
    if (dirtyRef.current) {
      setPendingProfileSwitch(profileId)
      return
    }
    switchToProfile(profileId)
  }

  const switchToProfile = (profileId: string) => {
    setActiveProfileId(profileId)
    setSelectedEntry(null)
    setBrowsePath([])
    if (!connectedIds.has(profileId)) {
      handleConnect(profileId)
    }
  }

  const handleReauth = async (password: string): Promise<boolean> => {
    if (!reauthProfile) return false
    await window.api.keychain.setPassword(reauthProfile.id, password)
    try {
      await connect(reauthProfile.id)
      setReauthProfile(null)
      return true
    } catch {
      return false
    }
  }

  const isConnected = activeProfileId != null && connectedIds.has(activeProfileId)

  return (
    <div className={styles.root}>
      <ServerSidebar
        profiles={profiles}
        connectedIds={connectedIds}
        activeProfileId={activeProfileId}
        theme={theme}
        width={sidebarWidth}
        serverTypes={serverTypes}
        onSelect={handleSelect}
        onAdd={() => { setEditingProfile(null); setShowProfileForm(true) }}
        onEdit={p => { setEditingProfile(p); setShowProfileForm(true) }}
        onConnect={handleConnect}
        onDisconnect={disconnect}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'system' : 'light')}
      />
      <ResizeHandle onResize={d => setSidebarWidth(w => Math.max(100, Math.min(300, w + d)))} />
      <div className={styles.main}>
        <div className={styles.topBar}>
          <SearchBar
            onSearch={(filter, scope, baseDn) => { setBrowsePath([]); search({ filter, scope, baseDn }) }}
            defaultBaseDn={activeBaseDn}
            serverType={activeServerType}
            disabled={!isConnected}
            onToggleTree={() => setShowTree(t => !t)}
            treeActive={showTree}
          />
        </div>
        {loading && (
          <div className={styles.progressBar}>
            <div className={styles.progressInner} />
          </div>
        )}
        {isConnected ? (
          <div className={styles.contentArea}>
            <div className={styles.browseColumn} style={{ width: browseWidth }}>
              {showTree && (
                <div className={styles.treeSection} style={{ height: treeHeight }}>
                  {activeBaseDn ? (
                    <TreePanel
                      key={activeProfileId}
                      profileId={activeProfileId!}
                      rootDn={activeBaseDn}
                      onBrowse={dn => { setBrowsePath([dn]); search({ filter: '(objectClass=*)', scope: 'one', baseDn: dn }) }}
                      onOpen={async dn => {
                        const entry = await window.api.ldap.getEntry(activeProfileId!, dn) as Entry
                        handleSelectEntry(entry)
                      }}
                    />
                  ) : (
                    <div className={styles.treePlaceholder}>
                      Detecting base DN…
                    </div>
                  )}
                </div>
              )}
              {showTree && (
                <ResizeHandle direction="vertical" onResize={d => setTreeHeight(h => Math.max(100, Math.min(500, h + d)))} />
              )}
              <div className={styles.resultsSection}>
                <BreadcrumbBar
                  path={browsePath}
                  onNavigate={dn => {
                    const idx = browsePath.indexOf(dn)
                    setBrowsePath(browsePath.slice(0, idx + 1))
                    search({ filter: '(objectClass=*)', scope: 'one', baseDn: dn })
                  }}
                />
                <ResultsList
                  entries={entries}
                  hasMore={hasMore}
                  loading={loading}
                  error={searchError}
                  selectedDn={selectedEntry?.dn ?? null}
                  onSelect={handleSelectEntry}
                  onBrowse={dn => { setBrowsePath(prev => [...prev, dn]); search({ filter: '(objectClass=*)', scope: 'one', baseDn: dn }) }}
                  onLoadMore={loadMore}
                  onNewEntry={() => setShowNewEntry(true)}
                />
              </div>
            </div>
            <ResizeHandle onResize={d => setBrowseWidth(w => Math.max(200, Math.min(500, w + d)))} />
            <div className={styles.detailArea}>
              {selectedEntry ? (
                <EntryDetail
                  entry={selectedEntry}
                  profileId={activeProfileId!}
                  attrColWidth={attrColWidth}
                  onSave={async (dn, changes) => {
                    await window.api.ldap.modifyEntry(activeProfileId!, dn, changes)
                    const updated = await window.api.ldap.getEntry(activeProfileId!, dn)
                    setSelectedEntry(updated as Entry)
                  }}
                  onDelete={async (dn) => {
                    await window.api.ldap.deleteEntry(activeProfileId!, dn)
                    setSelectedEntry(null)
                  }}
                  onOpenMultiModal={setMultiModalAttr}
                  onDirtyChange={dirty => { dirtyRef.current = dirty }}
                  saveRef={saveRef}
                />
              ) : (
                <div className={styles.placeholder}>
                  <span>Select an entry</span>
                  <span className={styles.placeholderSub}>Browse the tree or search to view entry attributes.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {connectionError && activeProfileId ? (
              <div className={styles.connectionError}>
                <div className={styles.connectionErrorTitle}>Connection failed</div>
                <div className={styles.connectionErrorMsg}>{connectionError}</div>
              </div>
            ) : activeProfileId ? (
              'Connecting…'
            ) : (
              <>
                <img src={appIcon} alt="RootNode" className={styles.emptyIcon} />
                <span className={styles.emptyText}>Select a server on the left or create a configuration</span>
              </>
            )}
          </div>
        )}
      </div>

      {showProfileForm && (
        <ProfileForm
          initial={editingProfile}
          onSave={handleSaveProfile}
          onDelete={remove}
          onClose={() => { setShowProfileForm(false); refresh() }}
        />
      )}

      {reauthProfile && (
        <ReauthModal
          profile={reauthProfile}
          onRetry={handleReauth}
          onCancel={() => setReauthProfile(null)}
          onEditProfile={() => { setReauthProfile(null); setEditingProfile(reauthProfile); setShowProfileForm(true) }}
        />
      )}

      {multiModalAttr && (
        <MultiValueModal
          attr={multiModalAttr}
          onSave={(name, values) => {
            if (!selectedEntry || !activeProfileId) return
            const change: LdapChange = { operation: 'replace', attribute: name, values }
            window.api.ldap.modifyEntry(activeProfileId, selectedEntry.dn, [change])
              .then(() => window.api.ldap.getEntry(activeProfileId, selectedEntry.dn))
              .then(e => setSelectedEntry(e as Entry))
              .catch((err: unknown) => {
                console.error('Failed to update attribute:', err)
              })
              .finally(() => setMultiModalAttr(null))
          }}
          onClose={() => setMultiModalAttr(null)}
        />
      )}
      {showNewEntry && (
        <NewEntryForm
          defaultBaseDn={activeProfile?.baseDn}
          onCreate={async (dn, attrs) => {
            await window.api.ldap.createEntry(activeProfileId!, dn, attrs)
            setShowNewEntry(false)
          }}
          onClose={() => setShowNewEntry(false)}
        />
      )}

      {pendingEntry && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <p className={styles.modalText}>You have unsaved changes. What would you like to do?</p>
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setPendingEntry(null)}>Cancel</button>
              <button
                className={styles.btnDiscard}
                onClick={() => {
                  dirtyRef.current = false
                  setSelectedEntry(pendingEntry)
                  setPendingEntry(null)
                }}
              >Discard</button>
              <button
                className={styles.btnSave}
                onClick={async () => {
                  if (saveRef.current) await saveRef.current()
                  dirtyRef.current = false
                  setSelectedEntry(pendingEntry)
                  setPendingEntry(null)
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
      {pendingProfileSwitch && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <p className={styles.modalText}>You have unsaved changes. What would you like to do?</p>
            <div className={styles.modalActions}>
              <button className={styles.btnCancel} onClick={() => setPendingProfileSwitch(null)}>Cancel</button>
              <button
                className={styles.btnDiscard}
                onClick={() => {
                  dirtyRef.current = false
                  const id = pendingProfileSwitch
                  setPendingProfileSwitch(null)
                  switchToProfile(id)
                }}
              >Discard</button>
              <button
                className={styles.btnSave}
                onClick={async () => {
                  if (saveRef.current) await saveRef.current()
                  dirtyRef.current = false
                  const id = pendingProfileSwitch
                  setPendingProfileSwitch(null)
                  switchToProfile(id)
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}
