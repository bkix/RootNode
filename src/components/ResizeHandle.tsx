import { useState, useCallback, useRef } from 'react'
import styles from './ResizeHandle.module.css'

interface Props {
  direction?: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

export function ResizeHandle({ direction = 'horizontal', onResize }: Props) {
  const [dragging, setDragging] = useState(false)
  const startPos = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startPos.current = direction === 'horizontal' ? e.clientX : e.clientY

    const handleMouseMove = (ev: MouseEvent) => {
      const current = direction === 'horizontal' ? ev.clientX : ev.clientY
      const delta = current - startPos.current
      startPos.current = current
      onResize(delta)
    }

    const handleMouseUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [direction, onResize])

  return (
    <div
      className={`${styles.handle} ${styles[direction]} ${dragging ? styles.dragging : ''}`}
      onMouseDown={handleMouseDown}
    />
  )
}
