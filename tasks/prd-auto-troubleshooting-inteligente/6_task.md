## status: done

<task_context>
<domain>n8n/llm</domain>
<type>integration</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>n8n, gemini-api, openai-api</dependencies>
</task_context>

# Tarefa 6.0: Integrar LLM e Implementar Triagem Automática

## Visão Geral

Configurar a integração com LLM (Gemini 3.0 ou GPT 5.2) no workflow n8n e implementar a lógica de triagem automática que classifica erros em: Infraestrutura, Código ou Desconhecido.

<requirements>
- Integração com API do LLM (Gemini ou OpenAI)
- System prompt com instruções de segurança
- Triagem automática com classificação em 3 categorias
- Precisão ≥ 80% na classificação
- Timeout de 60 segundos
</requirements>

## Subtarefas

- [x] 6.1 Configurar credenciais do LLM no n8n
- [x] 6.2 Criar system prompt com instruções de diagnóstico
- [x] 6.3 Adicionar instruções de segurança (NUNCA expor secrets)
- [x] 6.4 Implementar nó de triagem (classificação inicial)
- [x] 6.5 Implementar lógica de roteamento por classificação
- [x] 6.6 Configurar timeout de 60 segundos
- [x] 6.7 Testar com os 3 cenários de exemplo

## Detalhes de Implementação

### System Prompt - Diagnóstico

```markdown
# INSTRUÇÕES DO ASSISTENTE DE DIAGNÓSTICO

Você é um especialista em diagnóstico de incidentes de software. Sua tarefa é analisar alertas de erro e fornecer diagnósticos precisos e acionáveis.

## FLUXO DE ANÁLISE

1. **TRIAGEM**: Classifique o erro em uma das categorias:
   - `infrastructure`: Problemas de Kubernetes (OOMKilled, CrashLoopBackOff, probes, recursos)
   - `code`: Bugs de aplicação (exceções, null pointers, erros de lógica)
   - `unknown`: Casos inconclusivos que precisam investigação adicional

2. **INVESTIGAÇÃO**: Use as ferramentas disponíveis para coletar evidências:
   - Para `infrastructure`: use tools de Kubernetes (describePod, getEvents, etc.)
   - Para `code`: use tools de Git (cloneRepo, readFile) para analisar o código
   - Para `unknown`: use httpRequest para testar conectividade se relevante

3. **DIAGNÓSTICO**: Produza um relatório com:
   - Resumo executivo (2-3 frases)
   - Classificação e confiança
   - Evidências coletadas
   - Causa raiz identificada
   - Sugestões de correção

## INSTRUÇÕES DE SEGURANÇA (OBRIGATÓRIAS)

NUNCA inclua no relatório:
- Valores de variáveis de ambiente
- Valores de Secrets do Kubernetes
- Senhas, tokens, API keys ou credenciais
- Dados pessoais (PII)

Ao mencionar Secrets ou ConfigMaps, liste APENAS os nomes das chaves, NUNCA os valores.

✅ CORRETO: "O Secret `db-credentials` possui as chaves: username, password, host"
❌ INCORRETO: "O Secret `db-credentials` contém: username=admin, password=abc123"

## FORMATO DE RESPOSTA

Responda sempre em JSON estruturado:

```json
{
  "classification": "infrastructure|code|unknown",
  "confidence": "alta|média|baixa",
  "severity": "critical|high|medium|low",
  "root_cause": "Descrição da causa raiz",
  "suggestions": ["Sugestão 1", "Sugestão 2"],
  "next_steps": ["Passo 1", "Passo 2"],
  "evidence": {
    "kubernetes": "Resumo das evidências K8s",
    "code": "Resumo das evidências de código",
    "network": "Resumo de testes de conectividade"
  }
}
```
```

### Prompt de Triagem Rápida

```markdown
Analise o seguinte alerta de erro e classifique-o:

**Serviço:** {{service_name}}
**Namespace:** {{namespace}}
**Pod:** {{pod_name}}
**Erro:** {{error_message}}
**Stack Trace:** {{stack_trace}}

Responda APENAS com JSON:
{
  "classification": "infrastructure|code|unknown",
  "confidence": "alta|média|baixa",
  "reasoning": "Breve explicação da classificação"
}
```

### Fluxo no n8n

```
[Webhook] 
    ↓
[Validação]
    ↓
[LLM - Triagem] → Classifica o erro
    ↓
[Switch - Classificação]
    ├─ infrastructure → [MCP K8s Tools] → [LLM - Análise Infra]
    ├─ code → [MCP Git Tools] → [LLM - Análise Código]
    └─ unknown → [MCP Network Tools] → [LLM - Estratégia Debug]
    ↓
[Merge]
    ↓
[Gerar Relatório]
```

### Configuração do LLM no n8n

```javascript
// Nó: AI Agent ou HTTP Request
// URL: https://generativelanguage.googleapis.com/v1/models/gemini-3.0-pro:generateContent
// Headers: { "x-goog-api-key": "{{$env.LLM_API_KEY}}" }

// Ou para OpenAI:
// URL: https://api.openai.com/v1/chat/completions
// Headers: { "Authorization": "Bearer {{$env.LLM_API_KEY}}" }
```

### Lógica de Classificação

| Padrão no Erro | Classificação |
|----------------|---------------|
| OOMKilled, CrashLoopBackOff | infrastructure |
| Probe failed, Liveness/Readiness | infrastructure |
| Resource limit, Memory/CPU | infrastructure |
| NullPointerException, NPE | code |
| IndexOutOfBoundsException | code |
| TypeError, AttributeError | code |
| Syntax error, Compilation | code |
| Connection timeout, refused | unknown |
| 5xx de API externa | unknown |
| Erro genérico | unknown |

## Critérios de Sucesso

- [ ] LLM responde em < 60 segundos
- [ ] Triagem classifica corretamente cenário OOMKilled como `infrastructure`
- [ ] Triagem classifica corretamente cenário NPE como `code`
- [ ] Triagem classifica corretamente cenário timeout como `unknown`
- [ ] System prompt impede exposição de secrets
- [ ] Roteamento funciona corretamente por classificação

## Referências

- PRD: F-002 (Triagem Automática)
- Tech Spec: Seção "Segurança - Prompt do LLM"
