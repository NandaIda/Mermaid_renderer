import { useState, useCallback } from 'react'

export function useHistory(initialValue) {
  const [history, setHistory] = useState([initialValue])
  const [currentIndex, setCurrentIndex] = useState(0)

  const current = history[currentIndex]

  const push = useCallback((value) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, currentIndex + 1)
      newHistory.push(value)
      // Limit history to last 50 items
      if (newHistory.length > 50) {
        newHistory.shift()
        setCurrentIndex(currentIndex)
      } else {
        setCurrentIndex(currentIndex + 1)
      }
      return newHistory
    })
  }, [currentIndex])

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, history.length])

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  return { current, push, undo, redo, canUndo, canRedo }
}
