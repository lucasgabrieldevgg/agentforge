import NextAuth, { type NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name (signup)", type: "text" },
        mode: { label: "mode", type: "text" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const email = creds.email.toLowerCase().trim()
        const mode = creds.mode || "login"

        if (mode === "signup") {
          const existing = await db.user.findUnique({ where: { email } })
          if (existing) throw new Error("Email já cadastrado")
          const hash = await bcrypt.hash(creds.password, 10)
          const name = creds.name?.trim() || email.split("@")[0]
          const user = await db.user.create({
            data: { email, name, password: hash },
          })
          // Enable built-in tools by default
          await db.integration.createMany({
            data: [
              { userId: user.id, service: "time", enabled: true, config: "{}" },
              { userId: user.id, service: "memory", enabled: true, config: "{}" },
            ],
          })
          return { id: user.id, email: user.email, name: user.name }
        }

        // login
        const user = await db.user.findUnique({ where: { email } })
        if (!user) throw new Error("Usuário não encontrado")
        const ok = await bcrypt.compare(creds.password, user.password)
        if (!ok) throw new Error("Senha incorreta")
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error augment
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-me",
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
