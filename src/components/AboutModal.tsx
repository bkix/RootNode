import { useState, useEffect } from 'react'
import styles from './AboutModal.module.css'
import { deps, appVersion } from 'virtual:deps'

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>
          <div className={styles.appName}>RootNode</div>
          <div className={styles.version}>Version {appVersion}</div>
        </div>
        <div className={styles.sectionLabel}>Built with:</div>
        <table className={styles.table}>
          <tbody>
            {deps.map(d => (
              <tr key={d.name} className={styles.row}>
                <td className={styles.depName}>{d.name}</td>
                <td className={styles.depVersion}>{d.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.footer}>
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export function useAboutModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    (window as any).__showAbout = () => setShow(true)
    return () => { delete (window as any).__showAbout }
  }, [])

  return { showAbout: show, setShowAbout: setShow }
}
