"use client"

import { create } from "zustand"

export type View = "landing" | "auth" | "dashboard" | "waitlist"

export type DashboardTab =
  | "chat"
  | "skills"
  | "integrations"
  | "keys"
  | "memory"
  | "settings"

type AppState = {
  view: View
  authMode: "login" | "signup"
  activeTab: DashboardTab
  waitlistReason?: string
  setView: (v: View) => void
  setAuthMode: (m: "login" | "signup") => void
  setActiveTab: (t: DashboardTab) => void
  setWaitlistReason: (r?: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: "landing",
  authMode: "login",
  activeTab: "chat",
  waitlistReason: undefined,
  setView: (view) => set({ view }),
  setAuthMode: (authMode) => set({ authMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setWaitlistReason: (waitlistReason) => set({ waitlistReason }),
}))
