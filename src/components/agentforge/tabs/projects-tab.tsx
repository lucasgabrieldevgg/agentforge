"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  Download,
  Upload,
  FolderOpen,
  MessageSquare,
  Clock,
  Pencil,
  Check,
  X,
  AlertCircle,
} from "lucide-react"
import { useProjectStore, type Project } from "@/stores/project-store"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/stores/app-store"

export function ProjectsTab() {
  const {
    projects,
    activeProjectId,
    createProject,
    deleteProject,
    renameProject,
    setActiveProject,
    exportProject,
    importProject,
  } = useProjectStore()
  const { toast } = useToast()
  const { setActiveTab } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    const id = createProject()
    toast({ title: "Projeto criado!", description: "Novo workspace pronto." })
    setActiveTab("chat")
  }

  const handleDelete = (project: Project) => {
    if (!confirm(`Excluir "${project.name}"? Esta ação não pode ser desfeita.`)) return
    deleteProject(project.id)
    toast({ title: "Projeto excluído", description: project.name })
  }

  const handleRename = (id: string) => {
    if (!editName.trim()) return
    renameProject(id, editName.trim())
    setEditingId(null)
    toast({ title: "Renomeado" })
  }

  const handleDownload = (project: Project) => {
    const json = exportProject(project.id)
    if (!json) return
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, "_")
    a.download = `agentforge-${safeName}-${project.id.slice(-6)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Projeto baixado", description: a.download })
  }

  const handleDownloadAll = () => {
    if (projects.length === 0) {
      toast({ title: "Nenhum projeto para baixar", variant: "destructive" })
      return
    }
    const json = JSON.stringify(
      { type: "agentforge-projects-export", version: 1, exportedAt: new Date().toISOString(), projects },
      null,
      2
    )
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `agentforge-all-projects-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Todos os projetos baixados", description: `${projects.length} projetos` })
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const json = ev.target?.result as string
      const id = importProject(json)
      if (id) {
        toast({ title: "Projeto importado!" })
        setActiveTab("chat")
      } else {
        toast({
          title: "Falha ao importar",
          description: "Arquivo inválido.",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleOpen = (project: Project) => {
    setActiveProject(project.id)
    setActiveTab("chat")
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              Projetos
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Seus workspaces de conversa. Cada projeto tem suas próprias mensagens e
              configurações. Tudo é salvo no seu navegador (localStorage) — se você
              limpar os dados, os projetos somem. Baixe pra preservar.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={handleCreate} className="font-mono glow-primary">
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        <Card className="p-3 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                <strong>Armazenamento local:</strong> os projetos ficam salvos só neste
                navegador. Para preservar, baixe o JSON e importe depois em outra máquina.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={handleDownloadAll} className="text-xs font-mono">
                  <Download className="w-3 h-3 mr-1" />
                  Baixar todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-mono"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Importar
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nenhum projeto ainda</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mt-1">
              Crie seu primeiro projeto pra começar. Cada projeto é um workspace
              independente com suas próprias conversas e configurações.
            </p>
          </div>
          <Button onClick={handleCreate} className="font-mono glow-primary">
            <Plus className="w-4 h-4 mr-1" />
            Criar primeiro projeto
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId
            const msgCount = project.messages.length
            const lastUpdate = new Date(project.updatedAt).toLocaleString("pt-BR")
            return (
              <Card
                key={project.id}
                className={`p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors ${
                  isActive ? "border-primary/40 bg-primary/5" : ""
                }`}
                onClick={() => handleOpen(project)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-primary voice-pulse mt-2 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      {editingId === project.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(project.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            className="h-7 text-sm font-mono"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(project.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <h3 className="font-semibold truncate">{project.name}</h3>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(project.id)
                        setEditName(project.name)
                      }}
                      title="Renomear"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleDownload(project)}
                      title="Baixar projeto"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(project)}
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {msgCount} {msgCount === 1 ? "msg" : "msgs"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lastUpdate}
                  </span>
                  {isActive && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30 ml-auto">
                      ATIVO
                    </Badge>
                  )}
                </div>

                {project.settings.model && (
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {project.settings.model}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
