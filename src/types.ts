export type SecurityMode = 'none' | 'starttls' | 'ldaps'
export type BindMethod = 'simple' | 'certificate'
export type SearchScope = 'base' | 'one' | 'sub'

export interface Profile {
  id: string
  name: string
  host: string
  port: number
  security: SecurityMode
  bindMethod: BindMethod
  bindDn?: string
  certPath?: string
  keyPath?: string
  baseDn?: string
}

export interface LdapAttribute {
  name: string
  values: string[]
}

export interface Entry {
  dn: string
  attributes: LdapAttribute[]
}

export interface LdapChange {
  operation: 'add' | 'replace' | 'delete'
  attribute: string
  values: string[]
}

export interface SearchOptions {
  filter: string
  scope: SearchScope
  baseDn?: string
  page?: number
  pageSize?: number
}

export interface SearchResult {
  entries: Entry[]
  total: number
  hasMore: boolean
}

export interface SchemaInfo {
  booleanAttributes: string[]
  multiValueAttributes: string[]
  allAttributes: string[]
}
