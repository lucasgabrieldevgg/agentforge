"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Eye,
  Download,
  X,
  Code2,
  Globe,
  RefreshCw,
  ExternalLink,
} from "lucide-react"
import type { Artifact, WorkspaceFile } from "@/stores/project-store"
import { useToast } from "@/hooks/use-toast"
import { extractArtifacts } from "@/components/agentforge/artifact-card"

// Combines multiple files into a single HTML document for preview
function combineFilesToHtml(files: Array<{ name: string; language: string; content: string }>): string {
  const html = files.find((f) => f.language === "html" || f.name.endsWith(".html"))
  const css = files.filter((f) => f.language === "css" || f.name.endsWith(".css"))
  const js = files.filter((f) => f.language === "javascript" || f.language === "js" || f.name.endsWith(".js"))

  if (html) {
    // Inject CSS and JS into the HTML
    let combined = html.content
    const cssTag = css.map((c) => `<style>\n${c.content}\n</style>`).join("\n")
    const jsTag = js.map((j) => `<script>\n${j.content}\n</script>`).join("\n")
    // Insert before </body> if exists, otherwise append
    if (combined.includes("</body>")) {
      combined = combined.replace("</body>", `${cssTag}\n${jsTag}\n</body>`)
    } else {
      combined += `\n${cssTag}\n${jsTag}`
    }
    return combined
  }

  // No HTML file — create one wrapping CSS and JS
  const cssTag = css.map((c) => `<style>\n${c.content}\n</style>`).join("\n")
  const jsTag = js.map((j) => `<script>\n${j.content}\n</script>`).join("\n")
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Preview</title>
${cssTag}
</head>
<body>
${jsTag}
</body>
</html>`
}

export function ProjectPreview({
  artifacts,
  workspaceFiles,
  onClose,
}: {
  artifacts: Artifact[]
  workspaceFiles: WorkspaceFile[]
  onClose: () => void
}) {
  const [view, setView] = useState<"preview" | "code">("preview")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const { toast } = useToast()

  // Combine all files (artifacts + workspace) for preview
  const allFiles = useMemo(() => {
    const files: Array<{ name: string; language: string; content: string }> = []
    // Add workspace files first (they're "the project")
    workspaceFiles.forEach((f) => files.push({ name: f.name, language: f.language, content: f.content }))
    // Add artifacts (code from chat) — skip duplicates by name
    artifacts.forEach((a) => {
      if (!files.find((f) => f.name === a.filename)) {
        files.push({ name: a.filename, language: a.language, content: a.content })
      }
    })
    return files
  }, [artifacts, workspaceFiles])

  const htmlContent = useMemo(() => combineFilesToHtml(allFiles), [allFiles])

  const canPreview = allFiles.some(
    (f) => f.language === "html" || f.name.endsWith(".html") || f.language === "javascript" || f.language === "css"
  )

  const handleDownloadAll = () => {
    // Download each file individually isn't possible from one click,
    // so we download a combined HTML or a JSON of all files
    const hasHtml = allFiles.some((f) => f.language === "html" || f.name.endsWith(".html"))
    if (hasHtml) {
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "project.html"
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "HTML combinado baixado" })
    } else {
      // Download as JSON
      const blob = new Blob([JSON.stringify(allFiles, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "project-files.json"
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Arquivos baixados (JSON)" })
    }
  }

  const handleOpenInNewTab = () => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-background shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-mono font-bold text-sm truncate">Preview do Projeto</h2>
          <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
            {allFiles.length} arquivos
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={view === "preview" ? "default" : "ghost"}
            className="font-mono text-xs h-7"
            onClick={() => setView("preview")}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            variant={view === "code" ? "default" : "ghost"}
            className="font-mono text-xs h-7"
            onClick={() => setView("code")}
          >
            <Code2 className="w-3.5 h-3.5 mr-1" />
            Código
          </Button>
          {view === "preview" && canPreview && (
            <Button
              size="sm"
              variant="ghost"
              className="font-mono text-xs h-7"
              onClick={() => setIframeKey((k) => k + 1)}
              title="Recarregar preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
          {view === "preview" && canPreview && (
            <Button
              size="sm"
              variant="ghost"
              className="font-mono text-xs h-7"
              onClick={handleOpenInNewTab}
              title="Abrir em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="font-mono text-xs h-7"
            onClick={handleDownloadAll}
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Baixar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {view === "preview" ? (
          <div className="flex-1 flex flex-col">
            {canPreview ? (
              <iframe
                key={iframeKey}
                srcDoc={htmlContent}
                className="flex-1 w-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                title="Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <Code2 className="w-12 h-12 mx-auto opacity-50" />
                  <p>Nenhum arquivo HTML/JS/CSS para preview.</p>
                  <p className="text-xs">Gere código no chat ou adicione arquivos no workspace.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex">
            {/* File list */}
            <div className="w-48 border-r border-border/50 overflow-y-auto shrink-0">
              {allFiles.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFile(f.name)}
                  className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-secondary/60 truncate flex items-center gap-2 ${
                    selectedFile === f.name ? "bg-primary/10 text-primary border-l-2 border-primary" : ""
                  }`}
                >
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
            {/* Code view */}
            <div className="flex-1 overflow-auto bg-card/40">
              {selectedFile ? (
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground">
                  <code>{allFiles.find((f) => f.name === selectedFile)?.content}</code>
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Selecione um arquivo
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
