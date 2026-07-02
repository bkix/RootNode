import { invoke } from '@tauri-apps/api/core'
import type { Profile, SearchOptions, LdapAttribute, LdapChange, SearchResult, Entry, SchemaInfo } from './types'

export const api = {
  profiles: {
    list: () => invoke<Profile[]>('profiles_list'),
    save: (profile: Profile) => invoke<void>('profiles_save', { profile }),
    delete: (id: string) => invoke<void>('profiles_delete', { id }),
    testConnection: (profile: Profile, password?: string) =>
      invoke<{ ok: boolean; error?: string }>('profiles_test_connection', { profile, password }),
  },
  ldap: {
    connect: (profileId: string) => invoke<void>('ldap_connect', { profileId }),
    disconnect: (profileId: string) => invoke<void>('ldap_disconnect', { profileId }),
    isConnected: (profileId: string) => invoke<boolean>('ldap_is_connected', { profileId }),
    getDetectedBaseDn: (profileId: string) => invoke<string | null>('ldap_get_detected_base_dn', { profileId }),
    getServerType: (profileId: string) => invoke<string>('ldap_get_server_type', { profileId }),
    search: (profileId: string, opts: SearchOptions) =>
      invoke<SearchResult>('ldap_search', { profileId, opts }),
    getEntry: (profileId: string, dn: string) =>
      invoke<Entry>('ldap_get_entry', { profileId, dn }),
    modifyEntry: (profileId: string, dn: string, changes: LdapChange[]) =>
      invoke<void>('ldap_modify_entry', { profileId, dn, changes }),
    createEntry: (profileId: string, dn: string, attrs: LdapAttribute[]) =>
      invoke<void>('ldap_create_entry', { profileId, dn, attrs }),
    deleteEntry: (profileId: string, dn: string) =>
      invoke<void>('ldap_delete_entry', { profileId, dn }),
  },
  keychain: {
    setPassword: (profileId: string, password: string) =>
      invoke<void>('keychain_set_password', { profileId, password }),
  },
  schema: {
    get: (profileId: string) => invoke<SchemaInfo | null>('schema_get', { profileId }),
    clear: (profileId: string) => invoke<void>('schema_clear', { profileId }),
    refresh: (profileId: string) => invoke<SchemaInfo | null>('schema_refresh', { profileId }),
  },
}

;(window as any).api = api

export type Api = typeof api
