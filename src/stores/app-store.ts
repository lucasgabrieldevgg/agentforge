"use client"

import { create } from "zustand"

export type View = "landing" | "auth" | "dashboard"

export type DashboardTab =
  | "chat"
  | "integrations"
  | "keys"
  | "memory"
  | "settings"

type AppState = {
  view: View
  authMode: "login" | "signup"
  activeTab: DashboardTab
  setView: (v: View) => void
  setAuthMode: (m: "login" | "signup") => void
  setActiveTab: (t: DashboardTab) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: "landing",
  authMode: "login",
  activeTab: "chat",
  setView: (view) => set({ view }),
  setAuthMode: (authMode) => set({ authMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
}))
