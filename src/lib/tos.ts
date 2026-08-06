// Terms of Service — version + text
// When you change the text, bump the version. Users who accepted an older
// version will be required to re-accept on next visit.

export const TOS_VERSION = "1.2.0"
export const TOS_DATE = "2026-08-06"

export const TOS_TITLE = `Termos de Uso — AgentForge v${TOS_VERSION} (${TOS_DATE})`

export const TOS_TEXT = `## 1. Sobre a plataforma

O AgentForge é uma plataforma open source que permite a você montar um agente pessoal conectando suas próprias chaves de API (OpenRouter, etc). A plataforma em si é gratuita.

## 2. Suas chaves, seus custos

Você traz suas próprias chaves de API. A plataforma não paga nem armazena suas chamadas em nome de terceiros. O uso das APIs externas é regido pelos termos de cada provedor (OpenRouter, etc).

## 3. Coleta de dados (obrigatória)

Para usar o AgentForge, você precisa aceitar a **coleta anônima de dados**. Coletamos:

- O conteúdo das suas conversas com o agente (mensagem + resposta)
- O nome do modelo LLM que você usou (ex: \`openai/gpt-oss-20b:free\`)
- As ferramentas/skills que o agente chamou e se funcionaram
- Um identificador anônimo (hash) que NÃO permite identificar você

**NÃO coletamos**: seu email, nome, senhas, chaves de API ou qualquer dado pessoal identificável.

Esses dados são usados exclusivamente para pesquisa e melhoria contínua da plataforma.

## 4. Recursos avançados

A coleta de dados é **obrigatória** para o uso da plataforma, incluindo recursos básicos e avançados (Thinking High/Max, Deep Research).

## 5. Auto-deleção de contas inativas

Para preservar recursos (estamos em free tier):

- **14 dias sem login**: sua conta é **desativada** (login bloqueado, dados preservados).
- **30 dias sem login**: sua conta e **todos os seus dados são permanentemente deletados**.

Para evitar a deleção, basta fazer login pelo menos uma vez a cada 30 dias.

## 6. Lista de espera (waitlist)

Quando a plataforma atinge o limite de usuários ativos, novos cadastros entram em uma **fila de espera**. Quando uma vaga libera (por inatividade ou deleção), o próximo da fila é notificado e tem **72 horas** para aceitar. Se não aceitar, a vaga vai para o próximo.

## 7. Segurança

Suas chaves de API são armazenadas no banco de dados da plataforma. Recomendamos que você use chaves com limites de uso configurados (a maioria dos provedores suporta isso).

## 8. Responsabilidade

A plataforma é fornecida "como está", sem garantias. Não somos responsáveis por danos decorrentes do uso (perda de dados, custos de API, respostas incorretas do agente, etc).

## 9. Mudanças nos termos

Podemos atualizar estes termos a qualquer momento. Se houver mudança material, você verá uma nova tela de aceite no próximo login.

— Equipe AgentForge, ${TOS_DATE}`

export function needsToSAcceptance(acceptedVersion: string | null): boolean {
  if (!acceptedVersion) return true
  return acceptedVersion !== TOS_VERSION
}
