"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  FileCode,
  Plus,
  Trash2,
  Download,
  Eye,
  X,
  Pencil,
  Check,
  FileText,
  FolderOpen,
} from "lucide-react"
import { useProjectStore, type WorkspaceFile } from "@/stores/project-store"
import { useToast } from "@/hooks/use-toast"

const LANGUAGE_ICONS: Record<string, typeof FileCode> = {
  javascript: FileCode,
  js: FileCode,
  typescript: FileCode,
  ts: FileCode,
  python: FileCode,
  py: FileCode,
  html: FileText,
  css: FileText,
  json: FileText,
  markdown: FileText,
  md: FileText,
}

export function WorkspaceTab() {
  const {
    projects,
    activeProjectId,
    addWorkspaceFile,
    updateWorkspaceFile,
    deleteWorkspaceFile,
  } = useProjectStore()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [newFileLang, setNewFileLang] = useState("text")
  const [editingFile, setEditingFile] = useState<WorkspaceFile | null>(null)
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const files = activeProject?.workspace || []

  // Listen for "add to workspace" events from artifacts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Omit<WorkspaceFile, "id" | "createdAt" | "updatedAt">
      if (activeProjectId) {
        // Check if file with same name already exists
        const existing = files.find((f) => f.name === detail.name)
        if (existing) {
          // Update content
          updateWorkspaceFile(activeProjectId, existing.id, { content: detail.content })
          toast({ title: "Arquivo atualizado", description: detail.name })
        } else {
          addWorkspaceFile(activeProjectId, detail)
          toast({ title: "Arquivo adicionado", description: detail.name })
        }
      }
    }
    window.addEventListener("agentforge:add-to-workspace", handler)
    return () => window.removeEventListener("agentforge:add-to-workspace", handler)
  }, [activeProjectId, files, addWorkspaceFile, updateWorkspaceFile, toast])

  const handleCreate = () => {
    if (!activeProjectId || !newFileName.trim()) return
    const name = newFileName.trim()
    const ext = name.split(".").pop()?.toLowerCase() || "txt"
    addWorkspaceFile(activeProjectId, {
      name,
      path: name,
      language: extToLang(ext),
      content: "",
    })
    toast({ title: "Arquivo criado", description: name })
    setNewFileName("")
    setShowCreate(false)
  }

  const handleDownload = (file: WorkspaceFile) => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Download", description: file.name })
  }

  const handleDownloadAll = () => {
    if (files.length === 0) {
      toast({ title: "Nenhum arquivo", variant: "destructive" })
      return
    }
    // Create a simple JSON export of all files
    const exportData = {
      project: activeProject?.name,
      files: files.map((f) => ({ name: f.name, language: f.language, content: f.content })),
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `workspace-${activeProject?.name || "export"}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Workspace exportado" })
  }

  const handleSaveEdit = () => {
    if (!editingFile || !activeProjectId) return
    updateWorkspaceFile(activeProjectId, editingFile.id, {
      content: editingFile.content,
      name: editingFile.name,
    })
    setEditingFile(null)
    toast({ title: "Arquivo salvo" })
  }

  if (!activeProject) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card className="p-12 text-center space-y-4">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto opacity-50" />
          <p className="text-muted-foreground">Selecione um projeto para ver seu workspace</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              Workspace
            </h2>
            <p className="text-muted-foreground text-sm">
              Arquivos do projeto <strong>{activeProject.name}</strong>. Código gerado pela IA
              pode ser adicionado aqui. Tudo salvo no navegador.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadAll} className="font-mono text-xs">
              <Download className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">Baixar tudo</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="font-mono">
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        {showCreate && (
          <Card className="p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-file-name">Nome do arquivo (com extensão)</Label>
              <Input
                id="new-file-name"
                placeholder="ex: main.py, index.html, styles.css"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") setShowCreate(false)
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!newFileName.trim()} size="sm">
                <Check className="w-3.5 h-3.5 mr-1" />
                Criar
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)} size="sm">
                Cancelar
              </Button>
            </div>
          </Card>
        )}
      </div>

      {files.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <FileCode className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Workspace vazio</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
              Crie arquivos manualmente ou adicione código gerado pela IA clicando em
              "Workspace" nos artefatos do chat.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="font-mono">
            <Plus className="w-4 h-4 mr-1" />
            Criar primeiro arquivo
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = LANGUAGE_ICONS[file.language.toLowerCase()] || FileCode
            return (
              <Card key={file.id} className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <Badge variant="outline" className="text-[9px] py-0 px-1">
                        {file.language}
                      </Badge>
                      <span>{file.content.split("\n").length} linhas</span>
                      <span>{file.content.length} chars</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setPreviewFile(file)}
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingFile(file)}
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDownload(file)}
                    title="Baixar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (activeProjectId && confirm(`Excluir ${file.name}?`)) {
                        deleteWorkspaceFile(activeProjectId, file.id)
                        toast({ title: "Arquivo excluído" })
                      }
                    }}
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <Card
            className="w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-primary shrink-0" />
                <span className="font-mono font-semibold truncate">{previewFile.name}</span>
                <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                  {previewFile.language}
                </Badge>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewFile(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground bg-card/40">
              <code>{previewFile.content}</code>
            </pre>
          </Card>
        </div>
      )}

      {/* Edit modal */}
      {editingFile && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingFile(null)}
        >
          <Card
            className="w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
              <Input
                value={editingFile.name}
                onChange={(e) => setEditingFile({ ...editingFile, name: e.target.value })}
                className="font-mono text-sm h-7 max-w-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Salvar
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <textarea
              value={editingFile.content}
              onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
              className="flex-1 p-4 text-xs font-mono bg-card/40 border-0 outline-none resize-none"
              placeholder="Escreva o código aqui..."
              autoFocus
            />
          </Card>
        </div>
      )}
    </div>
  )
}

function extToLang(ext: string): string {
  const e = ext.toLowerCase()
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    php: "php",
    rb: "ruby",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    sh: "bash",
    md: "markdown",
  }
  return map[e] || "text"
}
