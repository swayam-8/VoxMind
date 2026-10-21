import * as React from "react"

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "warning" | "danger"
  duration?: number
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToastItem }
  | { type: "DISMISS_TOAST"; id: string }

let listeners: Array<(state: ToastItem[]) => void> = []
let memoryState: ToastItem[] = []

function dispatch(action: ToastAction) {
  switch (action.type) {
    case "ADD_TOAST":
      memoryState = [...memoryState, action.toast]
      break
    case "DISMISS_TOAST":
      memoryState = memoryState.filter((t) => t.id !== action.id)
      break
  }
  listeners.forEach((listener) => listener(memoryState))
}

export function toast({
  title,
  description,
  variant = "default",
  duration = 4000,
}: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).substring(2, 9)
  dispatch({
    type: "ADD_TOAST",
    toast: { id, title, description, variant, duration },
  })

  if (duration > 0) {
    setTimeout(() => {
      dispatch({ type: "DISMISS_TOAST", id })
    }, duration)
  }

  return id
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setToasts)
    return () => {
      listeners = listeners.filter((l) => l !== setToasts)
    }
  }, [])

  return {
    toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS_TOAST", id }),
  }
}
