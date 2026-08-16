"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ProjectMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  thinking?: string
  thinkingSource?: "native" | "synthetic" | "none"
  model?: string
  streaming?: boolean
  toolCalls?: Array<{
    name: string
    args: Record<string, unknown>
    result?: unknown
    ok?: boolean
    status?: "running" | "done"
  }>
  artifacts?: Artifact[]
  ts: number
}

export type Artifact = {
  id: string
  filename: string
  language: string
  content: string
  createdAt: number
}

export type WorkspaceFile = {
  id: string
  name: string
  path: string
  language: string
  content: string
  createdAt: number
  updatedAt: number
}

export type Project = {
  id: string
  name: string
  description?: string
  messages: ProjectMessage[]
  settings: {
    model?: string
    deepResearchLevel?: "quick" | "high" | "max"
    thinkingLevel?: "quick" | "high" | "max"
    language?: string
    ttsEnabled?: boolean
  }
  workspace: WorkspaceFile[]
  createdAt: number
  updatedAt: number
}

type ProjectState = {
  projects: Project[]
  activeProjectId: string | null
  createProject: (name?: string) => string
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  setActiveProject: (id: string) => void
  addMessage: (projectId: string, message: ProjectMessage) => void
  updateMessage: (projectId: string, messageId: string, updates: Partial<ProjectMessage>) => void
  clearMessages: (projectId: string) => void
  updateSettings: (projectId: string, settings: Partial<Project["settings"]>) => void
  addWorkspaceFile: (projectId: string, file: Omit<WorkspaceFile, "id" | "createdAt" | "updatedAt">) => string
  updateWorkspaceFile: (projectId: string, fileId: string, updates: Partial<WorkspaceFile>) => void
  deleteWorkspaceFile: (projectId: string, fileId: string) => void
  exportProject: (id: string) => string | null
  importProject: (json: string) => string | null
}

function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      createProject: (name) => {
        const id = generateId()
        const now = Date.now()
        const project: Project = {
          id,
          name: name || `Projeto ${get().projects.length + 1}`,
          messages: [],
          settings: {
            model: "openai/gpt-oss-20b:free",
            deepResearchLevel: "high",
            thinkingLevel: "quick",
            ttsEnabled: true,
          },
          workspace: [],
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: id,
        }))
        return id
      },

      deleteProject: (id) => {
        set((state) => {
          const projects = state.projects.filter((p) => p.id !== id)
          const activeProjectId =
            state.activeProjectId === id
              ? projects[0]?.id || null
              : state.activeProjectId
          return { projects, activeProjectId }
        })
      },

      renameProject: (id, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }))
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id })
      },

      addMessage: (projectId, message) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, messages: [...p.messages, message], updatedAt: Date.now() }
              : p
          ),
        }))
      },

      updateMessage: (projectId, messageId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  messages: p.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                  updatedAt: Date.now(),
                }
              : p
          ),
        }))
      },

      clearMessages: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, messages: [], updatedAt: Date.now() } : p
          ),
        }))
      },

      updateSettings: (projectId, settings) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, settings: { ...p.settings, ...settings }, updatedAt: Date.now() }
              : p
          ),
        }))
      },

      addWorkspaceFile: (projectId, file) => {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const now = Date.now()
        const wsFile: WorkspaceFile = {
          ...file,
          id: fileId,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, workspace: [...p.workspace, wsFile], updatedAt: now }
              : p
          ),
        }))
        return fileId
      },

      updateWorkspaceFile: (projectId, fileId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  workspace: p.workspace.map((f) =>
                    f.id === fileId ? { ...f, ...updates, updatedAt: Date.now() } : f
                  ),
                  updatedAt: Date.now(),
                }
              : p
          ),
        }))
      },

      deleteWorkspaceFile: (projectId, fileId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, workspace: p.workspace.filter((f) => f.id !== fileId), updatedAt: Date.now() }
              : p
          ),
        }))
      },

      exportProject: (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return null
        return JSON.stringify(project, null, 2)
      },

      importProject: (json) => {
        try {
          const data = JSON.parse(json) as Project
          if (!data.name || !Array.isArray(data.messages)) return null
          const newId = generateId()
          const project: Project = {
            ...data,
            id: newId,
            createdAt: data.createdAt || Date.now(),
            updatedAt: Date.now(),
          }
          set((state) => ({
            projects: [...state.projects, project],
            activeProjectId: newId,
          }))
          return newId
        } catch {
          return null
        }
      },
    }),
    {
      name: "agentforge-projects",
      version: 1,
    }
  )
)
