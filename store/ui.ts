'use client'
import { create } from 'zustand'

export type SyncStatus = 'ok' | 'syncing' | 'error' | 'offline' | 'unauthorized'
export type BottomNavTab = 'timeline' | 'journal' | 'vault' | 'settings'
export type SavingState = 'idle' | 'saving' | 'saved'

interface UIStore {
  activeFilter: string
  setActiveFilter: (filter: string) => void

  syncStatus: SyncStatus
  setSyncStatus: (status: SyncStatus) => void

  vaultLocked: boolean
  setVaultLocked: (locked: boolean) => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  activeTab: BottomNavTab
  setActiveTab: (tab: BottomNavTab) => void

  savingState: SavingState
  setSavingState: (state: SavingState) => void

  isSearchOpen: boolean
  setIsSearchOpen: (open: boolean) => void

  audioRecording: boolean
  setAudioRecording: (recording: boolean) => void

  particleEffects: boolean
  setParticleEffects: (v: boolean) => void

  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void

  toast: Toast | null
  showToast: (message: string, action?: Omit<Toast, 'message' | 'id'>) => void
  hideToast: () => void
}

export type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void; persistent?: boolean }

export const useUIStore = create<UIStore>((set) => ({
  activeFilter: 'Tudo',
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  syncStatus: 'ok',
  setSyncStatus: (status) => set({ syncStatus: status }),

  vaultLocked: true,
  setVaultLocked: (locked) => set({ vaultLocked: locked }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  activeTab: 'timeline',
  setActiveTab: (tab) => set({ activeTab: tab }),

  savingState: 'idle',
  setSavingState: (state) => set({ savingState: state }),

  isSearchOpen: false,
  setIsSearchOpen: (open) => set({ isSearchOpen: open }),

  audioRecording: false,
  setAudioRecording: (recording) => set({ audioRecording: recording }),

  particleEffects: true,
  setParticleEffects: (v) => set({ particleEffects: v }),

  reducedMotion: false,
  setReducedMotion: (v) => set({ reducedMotion: v }),

  toast: null,
  showToast: (message, action) => set({ toast: { id: Date.now(), message, ...action } }),
  hideToast: () => set({ toast: null }),
}))
