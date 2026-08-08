import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
