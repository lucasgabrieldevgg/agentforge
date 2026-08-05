"use client"

import dynamic from "next/dynamic"

// Avoid SSR issues with NextAuth session
const AgentForge = dynamic(
  () => import("@/components/agentforge/agent-forge").then((m) => m.AgentForge),
  { ssr: false }
)

export default function Home() {
  return <AgentForge />
}
