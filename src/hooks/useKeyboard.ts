import { useEffect, useRef } from 'react'

export function useKeyboard() {
  const keys = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      keys.current[event.key.toLowerCase()] = pressed
    }
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return keys
}
