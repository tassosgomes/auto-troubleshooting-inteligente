## status: pending

<task_context>
<domain>n8n/resilience</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>n8n</dependencies>
</task_context>

# Tarefa 10.0: Implementar Fallback e Resiliência

## Visão Geral

Implementar mecanismos de fallback e resiliência para garantir que o sistema entregue valor mesmo em cenários de falha parcial. Inclui fallback para LLM indisponível, análise parcial e tratamento de erros.

<requirements>
- Fallback quando LLM está indisponível
- Envio de análise parcial + alerta original em caso de falha
- Tratamento de erros em cada etapa
- Notificação clara de falhas ao usuário
- Logs de erros para diagnóstico
</requirements>

## Subtarefas

- [ ] 10.1 Implementar timeout de 60s para chamadas ao LLM
- [ ] 10.2 Criar fluxo de fallback para LLM indisponível
- [ ] 10.3 Implementar envio de análise parcial quando possível
- [ ] 10.4 Criar template de e-mail de fallback
- [ ] 10.5 Adicionar tratamento de erro para falha de clone Git
- [ ] 10.6 Adicionar tratamento de erro para K8s inacessível
- [ ] 10.7 Implementar logs estruturados para erros
- [ ] 10.8 Testar cenários de falha

## Detalhes de Implementação

### Fluxo com Fallback

```
[Webhook]
    ↓
[Validação]
    ↓
[Triagem LLM] ─── timeout/erro ──► [Fallback: Enviar alerta original]
    ↓
[Análise K8s] ─── erro ──► [Continuar sem dados K8s]
    ↓
[Análise Código] ─── erro ──► [Continuar sem dados de código]
    ↓
[Gerar Relatório]
    ↓
[Salvar Ticket] (analysis_partial = true se houve fallback)
    ↓
[Enviar E-mail]
```

### Fallback para LLM Indisponível

```javascript
// No workflow n8n

// Nó: LLM com timeout
const LLM_TIMEOUT_MS = 60000;

try {
  const response = await callLLM(prompt, { timeout: LLM_TIMEOUT_MS });
  return response;
} catch (error) {
  // Fallback: marcar como erro e continuar
  return {
    fallback: true,
    error: error.message,
    classification: 'unknown',
    message: 'Análise automática indisponível no momento'
  };
}
```

### Template de E-mail de Fallback

```markdown
# ⚠️ Alerta de Erro - Análise Automática Indisponível

**Ticket ID:** {{ticket_id}}
**Data:** {{timestamp}}
**Serviço:** {{service_name}}
**Namespace:** {{namespace}}

---

## Aviso

O sistema de Auto-Troubleshooting não conseguiu completar a análise automática deste incidente.

**Motivo:** {{fallback_reason}}

---

## Alerta Original

**Erro:** 
```
{{error_message}}
```

{{#if stack_trace}}
**Stack Trace:**
```
{{stack_trace}}
```
{{/if}}

{{#if partial_analysis}}
---

## Análise Parcial

{{partial_analysis}}
{{/if}}

---

## Próximos Passos

1. Verifique manualmente o pod: `kubectl describe pod {{pod_name}} -n {{namespace}}`
2. Consulte os logs: `kubectl logs {{pod_name}} -n {{namespace}}`
3. Se o problema persistir, escale para o time responsável

---

*Este é um e-mail automático do sistema Auto-Troubleshooting.*
*A análise automática falhou, mas o alerta foi encaminhado para sua atenção.*
```

### Lógica de Análise Parcial

```javascript
// Coletar o que for possível e enviar

async function analyzeWithFallback(alert) {
  const result = {
    ticket_id: generateUUID(),
    alert_original: alert,
    analysis_partial: false,
    partial_analysis: '',
    fallback_reason: null
  };

  // Tentar análise K8s
  let k8sAnalysis = null;
  try {
    k8sAnalysis = await analyzeKubernetes(alert.namespace, alert.pod_name);
    result.partial_analysis += formatK8sAnalysis(k8sAnalysis);
  } catch (error) {
    result.fallback_reason = 'Erro ao acessar Kubernetes';
    result.analysis_partial = true;
  }

  // Tentar análise de código
  let codeAnalysis = null;
  try {
    const deployment = await getDeployment(alert.namespace, alert.service_name);
    const metadata = JSON.parse(deployment.annotations['project.info/metadata']);
    codeAnalysis = await analyzeCode(metadata.repo_url, metadata.branch, alert.stack_trace);
    result.partial_analysis += formatCodeAnalysis(codeAnalysis);
  } catch (error) {
    if (!result.fallback_reason) {
      result.fallback_reason = 'Erro ao acessar repositório de código';
    }
    result.analysis_partial = true;
  }

  // Tentar classificação com LLM
  try {
    const llmResult = await classifyWithLLM(alert, k8sAnalysis, codeAnalysis);
    result.classification = llmResult.classification;
    result.diagnosis = llmResult.diagnosis;
  } catch (error) {
    result.fallback_reason = 'Serviço de IA indisponível';
    result.analysis_partial = true;
    result.classification = 'unknown';
  }

  return result;
}
```

### Tratamento de Erro no Workflow n8n

```javascript
// Nó Error Trigger para capturar erros

// 1. Logar erro estruturado
console.error(JSON.stringify({
  level: 'ERROR',
  timestamp: new Date().toISOString(),
  ticket_id: $json.ticket_id,
  service_name: $json.service_name,
  error_type: $json.error?.name || 'UnknownError',
  error_message: $json.error?.message || 'Erro desconhecido',
  stack: $json.error?.stack
}));

// 2. Preparar dados para fallback
return {
  ...$json,
  analysis_partial: true,
  fallback_reason: $json.error?.message || 'Erro durante processamento'
};
```

### Flags de Resiliência no Ticket

```sql
-- Adicionar coluna para rastrear análises parciais
-- Já existe no schema: analysis_partial BOOLEAN DEFAULT FALSE

-- Queries úteis para monitoramento
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN analysis_partial THEN 1 ELSE 0 END) as parciais,
  (SUM(CASE WHEN analysis_partial THEN 1 ELSE 0 END)::float / COUNT(*)) * 100 as pct_parciais
FROM diagnosis_tickets
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## Critérios de Sucesso

- [ ] LLM timeout após 60s dispara fallback
- [ ] E-mail de fallback enviado em < 1 minuto
- [ ] Análise parcial inclui dados de K8s mesmo sem LLM
- [ ] Erro de clone Git não bloqueia envio de e-mail
- [ ] Erro de K8s não bloqueia envio de e-mail
- [ ] Logs estruturados capturados para todos os erros
- [ ] Ticket salvo mesmo em caso de análise parcial

## Referências

- PRD: F-010 (Fallback para LLM Indisponível)
- Tech Spec: Seção "Tratamento de erro" em cada integração
