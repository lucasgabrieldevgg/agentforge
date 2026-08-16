"use client"

import { create } from "zustand"

export type DashboardTab =
  | "projects"
  | "chat"
  | "workspace"
  | "skills"
  | "integrations"
  | "keys"
  | "benchmark"
  | "memory"

type AppState = {
  activeTab: DashboardTab
  setActiveTab: (t: DashboardTab) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "projects",
  setActiveTab: (activeTab) => set({ activeTab }),
}))
