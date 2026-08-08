"use client"

import { useState, useEffect, useRef } from "react"
import { Sparkles, Zap } from "lucide-react"

type SkillInfo = {
  name: string
  display_name: string
  description: string
  slash_command: string
  aliases: string[]
  auto_trigger: boolean
  enabled: boolean
}

export function SkillsMenu({
  input,
  onPick,
  skills,
}: {
  input: string
  onPick: (command: string) => void
  skills: SkillInfo[]
}) {
  const [show, setShow] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Detect if input starts with / and is a single word (no space yet)
  const slashMatch = input.match(/^\/(\w*)$/)

  useEffect(() => {
    if (slashMatch) {
      setShow(true)
      setSelectedIndex(0)
    } else {
      setShow(false)
    }
  }, [slashMatch?.[1]])

  // Filter skills based on what user typed after /
  const query = slashMatch?.[1]?.toLowerCase() || ""
  const filtered = skills
    .filter((s) => s.enabled)
    .filter((s) => {
      if (!query) return true
      return (
        s.slash_command.toLowerCase().includes(query) ||
        s.aliases.some((a) => a.toLowerCase().includes(query)) ||
        s.display_name.toLowerCase().includes(query)
      )
    })

  // Keyboard navigation
  useEffect(() => {
    if (!show) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault()
        e.stopPropagation()
        onPick(filtered[selectedIndex].slash_command)
      } else if (e.key === "Escape") {
        setShow(false)
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [show, filtered, selectedIndex, onPick])

  if (!show || filtered.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-w-3xl mx-auto"
    >
      <div className="rounded-lg border border-primary/30 bg-card/95 backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border/40 bg-primary/5 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono text-primary font-semibold">
            Skills disponíveis
          </span>
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
            ↑↓ navegar · Enter selecionar · Esc fechar
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((skill, idx) => (
            <button
              key={skill.name}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onPick(skill.slash_command)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                idx === selectedIndex ? "bg-primary/10" : "hover:bg-secondary/40"
              }`}
            >
              <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-primary font-semibold">
                    /{skill.slash_command}
                  </code>
                  <span className="text-sm font-medium truncate">{skill.display_name}</span>
                  {skill.auto_trigger && (
                    <span className="text-[9px] font-mono text-primary bg-primary/10 px-1 py-0.5 rounded border border-primary/30">
                      AUTO
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
              </div>
              {skill.aliases.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {skill.aliases.slice(0, 2).map((alias) => (
                    <code
                      key={alias}
                      className="text-[10px] font-mono text-muted-foreground bg-secondary/40 px-1 py-0.5 rounded"
                    >
                      /{alias}
                    </code>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
