"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileCode,
  Download,
  Eye,
  X,
  FolderPlus,
  Copy,
  Check,
  Code2,
  Play,
} from "lucide-react"
import type { Artifact, WorkspaceFile } from "@/stores/project-store"
import { useToast } from "@/hooks/use-toast"
import { PythonRunner } from "@/components/agentforge/python-runner"

// Parse code blocks from markdown content
// Handles BOTH complete (```...```) and incomplete (```... without closing) blocks
// Deduplicates by language (only one artifact per language type)
export function extractArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = []
  const seenLanguages = new Set<string>()
  let idx = 0

  // First: match complete code blocks ```lang\ncontent```
  const completePattern = /```(\w+)?\n([\s\S]*?)```/g
  let match
  while ((match = completePattern.exec(content)) !== null) {
    const language = match[1] || "text"
    const code = match[2].trim()
    if (code.length > 20 && !seenLanguages.has(language)) {
      seenLanguages.add(language)
      const filename = guessFilename(language, idx)
      artifacts.push({
        id: `artifact_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        filename,
        language,
        content: code,
        createdAt: Date.now(),
      })
      idx++
    }
  }

  // Second: check for incomplete code blocks (opening ``` without closing)
  // This happens when streaming is cut off by timeout
  const incompletePattern = /```(\w+)?\n([\s\S]*?)$/
  const incompleteMatch = content.match(incompletePattern)
  if (incompleteMatch) {
    const language = incompleteMatch[1] || "text"
    const code = incompleteMatch[2].trim()
    // Only add if: substantial, NOT already captured, and language not seen
    if (code.length > 20 && !artifacts.some((a) => a.content === code) && !seenLanguages.has(language)) {
      const filename = guessFilename(language, idx)
      artifacts.push({
        id: `artifact_incomplete_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        filename,
        language,
        content: code,
        createdAt: Date.now(),
      })
      idx++
    }
  }

  return artifacts
}

// Strip code blocks from content, leaving only the narration text
// Handles both complete and incomplete (unclosed) code blocks
// Also strips <thinking> tags that models sometimes leak into the response
export function stripCodeBlocks(content: string): string {
  return content
    .replace(/```(\w+)?\n[\s\S]*?```/g, "") // complete blocks
    .replace(/```(\w+)?\n[\s\S]*$/g, "") // incomplete blocks (no closing)
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, "") // complete thinking tags
    .replace(/<thinking>[\s\S]*$/gi, "") // incomplete thinking tags
    .replace(/\n{3,}/g, "\n\n") // clean up extra newlines
    .trim()
}

function guessFilename(language: string, idx: number): string {
  const extensions: Record<string, string> = {
    javascript: "js", js: "js", typescript: "ts", ts: "ts",
    jsx: "jsx", tsx: "tsx", python: "py", py: "py",
    rust: "rs", go: "go", java: "java", c: "c", cpp: "cpp",
    "c++": "cpp", csharp: "cs", cs: "cs", php: "php",
    ruby: "rb", rb: "rb", swift: "swift", kotlin: "kt",
    html: "html", css: "css", scss: "scss", json: "json",
    yaml: "yaml", yml: "yml", xml: "xml", sql: "sql",
    bash: "sh", sh: "sh", shell: "sh", dockerfile: "Dockerfile",
    markdown: "md", md: "md",
  }
  const ext = extensions[language.toLowerCase()] || "txt"
  if (ext === "Dockerfile") return "Dockerfile"
  return `snippet-${idx + 1}.${ext}`
}

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript", js: "JavaScript", typescript: "TypeScript", ts: "TypeScript",
  jsx: "React JSX", tsx: "React TSX", python: "Python", py: "Python",
  rust: "Rust", go: "Go", java: "Java", c: "C", cpp: "C++",
  php: "PHP", ruby: "Ruby", html: "HTML", css: "CSS",
  json: "JSON", yaml: "YAML", sql: "SQL", bash: "Bash", sh: "Shell",
  markdown: "Markdown",
}

export function ArtifactCard({
  artifact,
  onAddToWorkspace,
  onPreview,
}: {
  artifact: Artifact
  onAddToWorkspace?: (file: Omit<WorkspaceFile, "id" | "createdAt" | "updatedAt">) => void
  onPreview?: (artifact: Artifact) => void
}) {
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showRunner, setShowRunner] = useState(false)
  const { toast } = useToast()
  const isPython = ["python", "py"].includes(artifact.language.toLowerCase())

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = artifact.filename
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Download iniciado", description: artifact.filename })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copiado!" })
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" })
    }
  }

  const handleAddToWorkspace = () => {
    if (onAddToWorkspace) {
      onAddToWorkspace({
        name: artifact.filename,
        path: artifact.filename,
        language: artifact.language,
        content: artifact.content,
      })
      toast({ title: "Adicionado ao workspace", description: artifact.filename })
    }
  }

  const label = LANGUAGE_LABELS[artifact.language.toLowerCase()] || artifact.language
  const lineCount = artifact.content.split("\n").length

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/20 bg-primary/5">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-4 h-4 text-primary shrink-0" />
          <span className="font-mono text-sm font-semibold truncate">{artifact.filename}</span>
          <Badge variant="outline" className="text-[9px] py-0 px-1 text-primary border-primary/30 shrink-0">
            {label}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {lineCount} linhas
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPython && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-mono text-emerald-400"
              onClick={() => setShowRunner(true)}
              title="Rodar no navegador (Pyodide)"
            >
              <Play className="w-3 h-3 mr-1" />
              Rodar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-mono text-primary"
            onClick={() => {
              if (onPreview) {
                onPreview(artifact)
              } else {
                setShowCode(!showCode)
              }
            }}
          >
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-mono"
            onClick={() => setShowCode(!showCode)}
          >
            <Code2 className="w-3 h-3 mr-1" />
            {showCode ? "Ocultar" : "Código"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-mono"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3 h-3 mr-1 text-primary" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          {onAddToWorkspace && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-mono"
              onClick={handleAddToWorkspace}
              title="Adicionar ao workspace (atualiza se já existe)"
            >
              <FolderPlus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Workspace</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-mono text-primary"
            onClick={handleDownload}
          >
            <Download className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Baixar</span>
          </Button>
        </div>
      </div>
      {showCode && (
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words text-muted-foreground bg-card/40 max-h-80 overflow-y-auto border-t border-primary/20">
          <code>{artifact.content}</code>
        </pre>
      )}
      {showRunner && (
        <PythonRunner
          open={showRunner}
          onOpenChange={setShowRunner}
          initialCode={artifact.content}
          filename={artifact.filename}
        />
      )}
    </div>
  )
}
