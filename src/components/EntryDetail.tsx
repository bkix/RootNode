import { useState, useEffect, type MutableRefObject } from 'react'
import { AttributeRow } from './AttributeRow'
import { ResizeHandle } from './ResizeHandle'
import type { Entry, LdapAttribute, LdapChange } from '../types'
import styles from './EntryDetail.module.css'

interface SchemaInfo {
  booleanAttributes: string[]
  multiValueAttributes: string[]
  allAttributes: string[]
}

interface Props {
  entry: Entry
  profileId: string
  attrColWidth: number
  onSave: (dn: string, changes: LdapChange[]) => Promise<void>
  onDelete: (dn: string) => Promise<void>
  onOpenMultiModal: (attr: LdapAttribute) => void
  onDirtyChange?: (dirty: boolean) => void
  saveRef?: MutableRefObject<(() => Promise<void>) | null>
}

export function EntryDetail({ entry, profileId, attrColWidth, onSave, onDelete, onOpenMultiModal, onDirtyChange, saveRef }: Props) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [schema, setSchema] = useState<SchemaInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newAttrName, setNewAttrName] = useState('')
  const [newAttrValue, setNewAttrValue] = useState('')
  const [showAttrDropdown, setShowAttrDropdown] = useState(false)
  const [showAddAttr, setShowAddAttr] = useState(false)
  const [deletedAttrs, setDeletedAttrs] = useState<string[]>([])

  const [localAttrColWidth, setLocalAttrColWidth] = useState(attrColWidth)

  useEffect(() => {
    setOverrides({})
    setDeletedAttrs([])
    setSaveError(null)
    setShowAddAttr(false)
    window.api.schema.get(profileId)
      .then(s => { console.log('Schema loaded:', s); setSchema(s as SchemaInfo | null) })
      .catch(() => setSchema(null))
  }, [entry.dn, profileId])

  const isDirty = Object.keys(overrides).length > 0 || deletedAttrs.length > 0 || (newAttrName !== '' && newAttrValue !== '')

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (saveRef) saveRef.current = handleSave
    return () => { if (saveRef) saveRef.current = null }
  })

  const isBool = (name: string) =>
    schema?.booleanAttributes.includes(name) ?? /^(pwd|account)/i.test(name)

  const isMulti = (name: string) =>
    schema?.multiValueAttributes.includes(name) ?? ['objectClass', 'member', 'memberOf', 'mail'].includes(name)

  const readOnlyAttrs = new Set([
    'objectclass', 'objectguid', 'objectsid', 'objectcategory',
    'distinguishedname', 'dn',
    'whencreated', 'whenchanged',
    'usnchanged', 'usncreated',
    'dscorepropagationdata',
    'instancetype', 'objectversion',
    'replpropertymetadata', 'repluptodatevector',
    'subschemasubentry',
    'structuralobjectclass', 'governsid',
    'createtimestamp', 'modifytimestamp',
    'creatorsname', 'modifiersname',
    'entryuuid', 'entrycsn', 'entrydn',
    'hassubordinates', 'numsubordinates',
    'nsuniqueid',
    'lastlogon', 'lastlogontimestamp', 'logoncount', 'badpwdcount', 'badpasswordtime',
    'pwdlastset', 'lockouttime',
    'msds-keyversionnumber', 'ridsetreferences',
    'primarygroupid',
  ])

  const isReadOnly = (name: string) => readOnlyAttrs.has(name.toLowerCase())

  const handleEdit = (name: string, value: string) => {
    setOverrides(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const changes: LdapChange[] = Object.entries(overrides).map(([attr, value]) => ({
        operation: 'replace',
        attribute: attr,
        values: [value],
      }))
      for (const attr of deletedAttrs) {
        changes.push({ operation: 'delete', attribute: attr, values: [] })
      }
      if (newAttrName && newAttrValue) {
        changes.push({ operation: 'add', attribute: newAttrName, values: [newAttrValue] })
      }
      await onSave(entry.dn, changes)
      setOverrides({})
      setDeletedAttrs([])
      setNewAttrName('')
      setNewAttrValue('')
      setShowAddAttr(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDelete(true)
  }

  const executeDelete = async () => {
    setConfirmDelete(false)
    try {
      await onDelete(entry.dn)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDeleteAttr = (name: string) => {
    setDeletedAttrs(prev => [...prev, name])
  }

  const attrGroups: Record<string, number> = {}
  const identityAttrs = ['cn', 'displayname', 'name', 'givenname', 'sn', 'initials', 'title', 'description', 'userprincipalname', 'samaccountname', 'uid', 'uidnumber', 'gidnumber']
  const contactAttrs = ['mail', 'telephonenumber', 'mobile', 'facsimiletelephonenumber', 'streetaddress', 'l', 'st', 'postalcode', 'co', 'c', 'physicaldeliveryofficename', 'homephone', 'pager', 'info']
  const orgAttrs = ['company', 'department', 'manager', 'directreports', 'division', 'employeeid', 'employeenumber', 'employeetype']
  const exchangeAttrs = ['homemdb', 'mailnickname', 'proxyaddresses', 'targetaddress', 'legacyexchangedn']
  const securityAttrs = ['useraccountcontrol', 'accountexpires', 'pwdlastset', 'lockouttime', 'badpwdcount', 'logoncount', 'lastlogon', 'lastlogontimestamp', 'whencreated', 'whenchanged', 'objectsid', 'objectguid', 'admincount']
  const groupAttrs = ['memberof', 'member', 'primarygroupid', 'grouptype']
  identityAttrs.forEach(a => { attrGroups[a] = 0 })
  contactAttrs.forEach(a => { attrGroups[a] = 1 })
  orgAttrs.forEach(a => { attrGroups[a] = 2 })
  exchangeAttrs.forEach(a => { attrGroups[a] = 3 })
  securityAttrs.forEach(a => { attrGroups[a] = 4 })
  groupAttrs.forEach(a => { attrGroups[a] = 5 })

  const getAttrGroup = (name: string): number => {
    const lower = name.toLowerCase()
    if (attrGroups[lower] !== undefined) return attrGroups[lower]
    if (lower.startsWith('msexch')) return 3
    return 6
  }

  const groupLabels = ['Identity', 'Contact', 'Organization', 'Exchange', 'Security', 'Groups', 'System']

  const displayAttrs = entry.attributes
    .filter(a => !deletedAttrs.includes(a.name))
    .map(a => ({
      ...a,
      values: overrides[a.name] !== undefined ? [overrides[a.name]] : a.values,
    }))
    .sort((a, b) => {
      const ga = getAttrGroup(a.name)
      const gb = getAttrGroup(b.name)
      if (ga !== gb) return ga - gb
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

  const cnAttr = entry.attributes.find(a => a.name.toLowerCase() === 'cn')
  const dnParts = entry.dn.split(',')
  const cn = cnAttr?.values[0] ?? dnParts[0] ?? entry.dn
  const parent = dnParts.slice(1).join(',')

  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <div className={styles.cn}>{cn}</div>
          <div className={styles.parent} title={parent}>{parent}</div>
        </div>
        <div className={styles.actions}>
          {isDirty && (
            <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <button onClick={handleDelete} className={styles.deleteBtn}>
            Delete
          </button>
        </div>
      </div>

      {saveError && (
        <div className={styles.errorBar}>{saveError}</div>
      )}

      <div className={styles.scrollArea}>
        <div className={styles.stickyHeader}>
          <div className={styles.headerRow}>
            <div className={styles.headerCell} style={{ width: localAttrColWidth }}>Attribute</div>
            <ResizeHandle onResize={d => setLocalAttrColWidth(w => Math.max(80, Math.min(320, w + d)))} />
            <div className={styles.headerCellFlex}>
              <span>Value</span>
              <button
                className={styles.addAttrBtn}
                onClick={() => setShowAddAttr(v => !v)}
              >{showAddAttr ? '− Cancel' : '+ Add Attribute'}</button>
            </div>
          </div>
          {showAddAttr && (
            <div className={styles.addAttrRow}>
              <div className={styles.inputCell} style={{ width: localAttrColWidth }}>
                <input
                  className={styles.addAttrInput}
                  placeholder="attr name"
                  value={newAttrName}
                  onChange={e => { setNewAttrName(e.target.value); setShowAttrDropdown(true) }}
                  onFocus={() => setShowAttrDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAttrDropdown(false), 150)}
                />
                {showAttrDropdown && schema?.allAttributes && (() => {
                  const filtered = schema.allAttributes.filter(a =>
                    a.toLowerCase().includes(newAttrName.toLowerCase()) &&
                    !entry.attributes.some(ea => ea.name === a)
                  )
                  if (filtered.length === 0) return null
                  return (
                    <div className={styles.dropdown}>
                      {filtered.slice(0, 50).map(a => (
                        <div
                          key={a}
                          className={styles.dropdownItem}
                          onMouseDown={() => { setNewAttrName(a); setShowAttrDropdown(false) }}
                        >{a}</div>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <div className={styles.valueCell}>
                <input
                  className={styles.addAttrInput}
                  placeholder="value"
                  value={newAttrValue}
                  onChange={e => setNewAttrValue(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        {displayAttrs.map((attr, i) => {
          const group = getAttrGroup(attr.name)
          const prevGroup = i > 0 ? getAttrGroup(displayAttrs[i - 1].name) : -1
          return (
            <div key={attr.name}>
              {group !== prevGroup && (
                <div className={styles.groupLabel}>
                  {groupLabels[group]}
                </div>
              )}
              <AttributeRow
                attr={attr}
                isBool={isBool(attr.name)}
                isMulti={isMulti(attr.name)}
                readOnly={isReadOnly(attr.name)}
                attrColWidth={localAttrColWidth}
                onEdit={handleEdit}
                onDelete={handleDeleteAttr}
                onOpenModal={onOpenMultiModal}
              />
            </div>
          )
        })}
      </div>

      {confirmDelete && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <p className={styles.modalTitle}>Delete Entry</p>
            <p className={styles.modalText}>
              Are you sure you want to delete <span className={styles.modalDn}>{entry.dn}</span>? This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmDelete(false)}
              >Cancel</button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={executeDelete}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
