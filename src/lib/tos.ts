// Terms of Service — version + text
// When you change the text, bump the version. Users who accepted an older
// version will be required to re-accept on next visit.

export const TOS_VERSION = "1.0.0"
export const TOS_DATE = "2026-08-05"

export const TOS_TITLE = `Termos de Uso — AgentForge v${TOS_VERSION} (${TOS_DATE})`

export const TOS_TEXT = `## 1. Sobre a plataforma

O AgentForge é uma plataforma open source que permite a você montar um agente pessoal (estilo Jarvis) conectando suas próprias chaves de API (OpenRouter, OpenWeatherMap, etc). A plataforma em si é gratuita.

## 2. Suas chaves, seus custos

Você traz suas próprias chaves de API. A plataforma não paga nem armazena suas chamadas em nome de terceiros. O uso das APIs externas é regido pelos termos de cada provedor (OpenRouter, OpenWeatherMap, Google, Twilio, etc).

## 3. Coleta de dados para pesquisa (Noesis Labs)

O AgentForge é mantido pela **Noesis Labs** para fins de pesquisa e desenvolvimento de modelos de IA (projeto Noema). Para isso, coletamos dados de uso de forma **anônima**:

- O conteúdo das suas conversas com o agente (mensagem + resposta)
- O nome do modelo LLM que você usou (ex: \`google/gemini-2.0-flash-exp:free\`)
- As ferramentas que o agente chamou e se funcionaram
- Um identificador anônimo (hash) que NÃO permite identificar você

**NÃO coletamos**: seu email, nome, senhas, chaves de API ou qualquer dado pessoal identificável.

Esses dados são enviados via bot do Telegram (@NoesisGGBot) e usados exclusivamente para pesquisa e treinamento de modelos da Noesis Labs.

## 4. Opt-out

Você pode desativar a coleta de telemetria a qualquer momento em **Settings → Privacidade**. Seu uso da plataforma não é afetado.

## 5. Auto-deleção de contas inativas

Para preservar recursos (estamos em free tier) e respeitar privacidade:

- **30 dias sem login**: sua conta é **desativada** (login bloqueado, dados preservados).
- **90 dias sem login**: sua conta e **todos os seus dados são permanentemente deletados**.

Para evitar a deleção, basta fazer login pelo menos uma vez a cada 90 dias.

## 6. Segurança

Suas chaves de API são armazenadas no banco de dados da plataforma. Em produção elas são criptografadas em repouso. Recomendamos que você use chaves com limites de uso configurados (a maioria dos provedores suporta isso).

## 7. Responsabilidade

A plataforma é fornecida "como está", sem garantias. Não somos responsáveis por danos decorrentes do uso (perda de dados, custos de API, respostas incorretas do agente, etc).

## 8. Mudanças nos termos

Podemos atualizar estes termos a qualquer momento. Se houver mudança material, você verá uma nova tela de aceite no próximo login.

## 9. Contato

Para dúvidas sobre privacidade ou seus dados: fale com o bot @NoesisGGBot no Telegram, ou abra uma issue no GitHub.

— Noesis Labs, ${TOS_DATE}`

export function needsToSAcceptance(acceptedVersion: string | null): boolean {
  if (!acceptedVersion) return true
  return acceptedVersion !== TOS_VERSION
}
