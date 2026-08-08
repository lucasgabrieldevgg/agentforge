"use client"

import { create } from "zustand"

export type DashboardTab =
  | "chat"
  | "skills"
  | "integrations"
  | "keys"
  | "memory"

type AppState = {
  activeTab: DashboardTab
  setActiveTab: (t: DashboardTab) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "chat",
  setActiveTab: (activeTab) => set({ activeTab }),
}))
