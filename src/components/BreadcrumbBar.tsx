import styles from './BreadcrumbBar.module.css'

interface Props {
  path: string[]
  onNavigate: (dn: string) => void
}

function getRdn(dn: string): string {
  return dn.split(',')[0] ?? dn
}

export function BreadcrumbBar({ path, onNavigate }: Props) {
  if (path.length === 0) return null
  return (
    <div className={styles.bar}>
      {path.map((dn, i) => (
        <span key={dn} className={styles.segment}>
          {i > 0 && <span className={styles.separator}>›</span>}
          <button
            onClick={() => onNavigate(dn)}
            className={`${styles.button} ${i === path.length - 1 ? styles.active : ''}`}
          >
            {getRdn(dn)}
          </button>
        </span>
      ))}
    </div>
  )
}
