import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Identidade FORJA: IBM Plex — tipografia de engenharia (IBM/Bauhaus),
// nada de fonte-default-de-template (Geist/Inter).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AgentForge — Plataforma open source de agentes com IA",
  description:
    "Construa seu assistente estilo Jarvis. Conecte APIs gratuitas, converse por voz, use skills com /comandos. Open source no GitHub.",
  keywords: ["Jarvis", "agente IA", "assistente pessoal", "OpenRouter", "Next.js", "open source"],
  authors: [{ name: "AgentForge" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "AgentForge — Plataforma de agentes com IA",
    description: "Construa seu Jarvis particular. Open source, grátis, com skills e ferramentas.",
    url: "https://agentforge-blue-zeta.vercel.app",
    siteName: "AgentForge",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="dark">
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
