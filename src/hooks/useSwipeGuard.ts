import { useRef } from 'react'

/**
 * A swipe ends with a pointer-up, which browsers turn into a click on whatever
 * is under the finger. Spread these props on the draggable element to swallow
 * that click so a swipe never also "taps" a day or a button.
 */
export function useSwipeGuard() {
  const dragged = useRef(false)
  return {
    onDragStart: () => {
      dragged.current = true
    },
    onDragEndCleanup: () => {
      setTimeout(() => (dragged.current = false), 80)
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (dragged.current) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
  }
}
