import { useState } from 'react'
import type { Profile } from '../types'
import styles from './ReauthModal.module.css'

interface Props {
  profile: Profile
  onRetry: (password: string) => Promise<boolean>
  onCancel: () => void
  onEditProfile: () => void
}

export function ReauthModal({ profile, onRetry, onCancel, onEditProfile }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRetry = async () => {
    setLoading(true)
    setError(null)
    try {
      const ok = await onRetry(password)
      if (!ok) setError('Password rejected again. Check the value or edit the profile.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.headerRow}>
          <span className={styles.icon}>🔐</span>
          <div>
            <div className={styles.headerTitle}>Authentication Failed</div>
            <div className={styles.headerSub}>{profile.name} · {profile.host}</div>
          </div>
        </div>
        <div className={styles.warning}>
          The password was rejected by the server (error 49). It may have been rotated.
        </div>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Bind DN</span>
          <div className={styles.fieldValue}>{profile.bindDn}</div>
        </div>
        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>New Password</span>
          <input
            autoFocus
            type="password"
            className={styles.passwordInput}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleRetry()}
          />
        </label>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.footer}>
          <button onClick={onEditProfile} className={styles.editLink}>Edit profile…</button>
          <div className={styles.footerActions}>
            <button onClick={onCancel} className={styles.cancelBtn}>Cancel</button>
            <button onClick={handleRetry} disabled={loading} className={styles.retryBtn}>
              {loading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
