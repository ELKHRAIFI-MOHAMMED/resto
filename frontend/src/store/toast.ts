import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  action?: { label: string; to: string }
}

interface ToastState {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

const TOAST_DURATION_MS = 4000
let nextId = 1

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }))
    setTimeout(() => get().dismiss(id), TOAST_DURATION_MS)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
