import { useState } from 'react'
import type { Profile, SecurityMode, BindMethod } from '../types'
import styles from './ProfileForm.module.css'

interface Props {
  initial?: Profile | null
  onSave: (profile: Profile, password?: string) => Promise<void>
  onDelete?: (id: string) => void
  onClose: () => void
}

function randomId() { return Math.random().toString(36).slice(2) }

export function ProfileForm({ initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(String(initial?.port ?? 389))
  const [security, setSecurity] = useState<SecurityMode>(initial?.security ?? 'none')
  const [bindMethod, setBindMethod] = useState<BindMethod>(initial?.bindMethod ?? 'simple')
  const [bindDn, setBindDn] = useState(initial?.bindDn ?? '')
  const [password, setPassword] = useState('')
  const [certPath, setCertPath] = useState(initial?.certPath ?? '')
  const [keyPath, setKeyPath] = useState(initial?.keyPath ?? '')
  const [baseDn, setBaseDn] = useState(initial?.baseDn ?? '')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const profile: Profile = {
    id: initial?.id ?? randomId(),
    name, host, port: Number(port), security, bindMethod,
    bindDn,
    certPath: bindMethod === 'certificate' ? certPath : undefined,
    keyPath: bindMethod === 'certificate' ? keyPath : undefined,
    baseDn: baseDn || undefined,
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.profiles.testConnection(profile, password || undefined) as { ok: boolean; error?: string }
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      await onSave(profile, bindMethod === 'simple' && password ? password : undefined)
      onClose()
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.title}>{initial ? 'Edit Server' : 'Add Server'}</div>

        <label className={styles.field}>
          <span className={styles.label}>Profile Name</span>
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.fieldFlex}>
            <span className={styles.label}>Host</span>
            <input className={styles.input} value={host} onChange={e => setHost(e.target.value)} />
          </label>
          <label className={styles.fieldPort}>
            <span className={styles.label}>Port</span>
            <input className={`${styles.input}`} style={{ width: '100%' }} value={port} onChange={e => setPort(e.target.value)} />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Security</span>
          <select className={styles.select} value={security} onChange={e => setSecurity(e.target.value as SecurityMode)}>
            <option value="none">None (LDAP)</option>
            <option value="starttls">STARTTLS</option>
            <option value="ldaps">LDAPS (TLS)</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Bind Method</span>
          <select className={styles.select} value={bindMethod} onChange={e => setBindMethod(e.target.value as BindMethod)}>
            <option value="simple">Simple (DN + password)</option>
            <option value="certificate">Certificate</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Bind DN</span>
          <input className={styles.input} value={bindDn} onChange={e => setBindDn(e.target.value)} />
        </label>

        {bindMethod === 'simple' && (
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input type="password" className={styles.input} value={password} onChange={e => setPassword(e.target.value)} placeholder={initial ? '(unchanged)' : ''} />
            <span className={styles.hint}>Stored in macOS Keychain</span>
          </label>
        )}

        {bindMethod === 'certificate' && (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Certificate Path</span>
              <input className={styles.inputMono} value={certPath} onChange={e => setCertPath(e.target.value)} placeholder="/path/to/cert.pem" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Private Key Path</span>
              <input className={styles.inputMono} value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="/path/to/key.pem" />
            </label>
          </>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Base DN (optional — auto-detected if blank)</span>
          <input className={styles.input} value={baseDn} onChange={e => setBaseDn(e.target.value)} placeholder="dc=example,dc=com" />
        </label>

        {testResult && (
          <div className={testResult.ok ? styles.resultOk : styles.resultErr}>
            {testResult.ok ? 'Connection successful' : `Failed: ${testResult.error}`}
          </div>
        )}

        <div className={styles.footer}>
          <button onClick={handleTest} disabled={testing} className={styles.testBtn}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <div className={styles.footerRight}>
            {initial && onDelete && (
              <button onClick={() => { onDelete(initial.id); onClose() }} className={styles.deleteBtn}>
                Delete
              </button>
            )}
            <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
            <button onClick={handleSave} className={styles.saveBtn}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
