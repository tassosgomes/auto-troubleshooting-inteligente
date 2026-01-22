## status: pending

<task_context>
<domain>n8n/report</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>n8n, handlebars</dependencies>
</task_context>

# Tarefa 7.0: Implementar Gerador de Relatório de Diagnóstico

## Visão Geral

Criar o gerador de relatórios em formato Markdown que compila todas as informações do diagnóstico em um documento claro, acionável e bem formatado.

<requirements>
- Template Markdown com seções padronizadas
- Inclusão de Ticket ID (UUID)
- Resumo executivo, classificação, evidências, sugestões
- NUNCA incluir valores de secrets
- Formato compatível com e-mail text/plain
</requirements>

## Subtarefas

- [ ] 7.1 Criar template Markdown do relatório
- [ ] 7.2 Implementar nó de geração no n8n (Code ou Template)
- [ ] 7.3 Gerar UUID para Ticket ID
- [ ] 7.4 Formatar evidências de K8s de forma legível
- [ ] 7.5 Formatar trechos de código com syntax highlighting
- [ ] 7.6 Adicionar link de feedback
- [ ] 7.7 Testar geração com dados dos 3 cenários

## Detalhes de Implementação

### Template do Relatório

```markdown
# 🔍 Diagnóstico de Incidente

**Ticket ID:** `{{ticket_id}}`  
**Data:** {{timestamp}}  
**Serviço:** {{service_name}}  
**Namespace:** {{namespace}}  

---

## 📋 Resumo Executivo

{{summary}}

## 🏷️ Classificação

| Campo | Valor |
|-------|-------|
| **Tipo** | {{classification}} |
| **Severidade** | {{severity}} |
| **Confiança** | {{confidence}} |

---

## 🔎 Evidências Coletadas

### Erro Original

```
{{error_message}}
```

{{#if stack_trace}}
### Stack Trace

```
{{stack_trace}}
```
{{/if}}

{{#if kubernetes_evidence}}
### Análise de Kubernetes

{{kubernetes_evidence}}
{{/if}}

{{#if code_evidence}}
### Análise de Código

{{code_evidence}}
{{/if}}

{{#if network_evidence}}
### Teste de Conectividade

{{network_evidence}}
{{/if}}

---

## 🎯 Causa Raiz Identificada

{{root_cause}}

---

## 💡 Sugestões de Correção

{{#each suggestions}}
{{@index}}. {{this}}
{{/each}}

---

## ⏭️ Próximos Passos

{{#each next_steps}}
- [ ] {{this}}
{{/each}}

---

*Este diagnóstico foi gerado automaticamente pelo Auto-Troubleshooting Inteligente.*

*Para análise adicional, você pode usar GitHub Copilot ou Claude Code com este relatório.*

📧 [Dar feedback sobre este diagnóstico]({{feedback_url}})
```

### Geração de UUID

```javascript
// Nó Code no n8n
const { randomUUID } = require('crypto');

const ticketId = randomUUID();
const timestamp = new Date().toISOString();

return {
  ticket_id: ticketId,
  timestamp: timestamp,
  ...
};
```

### Formatação de Evidências K8s

```javascript
// Formatar eventos do pod de forma legível
function formatKubernetesEvidence(podDescription, events) {
  let output = '';

  // Status do Pod
  output += `**Pod:** ${podDescription.name}\n`;
  output += `**Status:** ${podDescription.status}\n\n`;

  // Container Status
  if (podDescription.containerStatuses?.length) {
    output += '**Containers:**\n';
    for (const container of podDescription.containerStatuses) {
      output += `- ${container.name}: ${container.ready ? '✅ Ready' : '❌ Not Ready'}`;
      output += ` (Restarts: ${container.restartCount})\n`;
      
      if (container.state?.terminated) {
        output += `  - Terminated: ${container.state.terminated.reason}\n`;
      }
      if (container.state?.waiting) {
        output += `  - Waiting: ${container.state.waiting.reason}\n`;
      }
    }
  }

  // Eventos Recentes
  if (events?.length) {
    output += '\n**Eventos Recentes:**\n';
    for (const event of events.slice(-5)) {
      const icon = event.type === 'Warning' ? '⚠️' : 'ℹ️';
      output += `${icon} [${event.reason}] ${event.message}\n`;
    }
  }

  return output;
}
```

### Formatação de Código

```javascript
// Formatar trecho de código com contexto
function formatCodeEvidence(filePath, lineNumber, codeSnippet, language) {
  const lines = codeSnippet.split('\n');
  const startLine = Math.max(1, lineNumber - 5);
  
  let output = `**Arquivo:** \`${filePath}\`\n`;
  output += `**Linha:** ${lineNumber}\n\n`;
  output += '```' + language + '\n';
  
  lines.forEach((line, index) => {
    const currentLine = startLine + index;
    const marker = currentLine === lineNumber ? '>>>' : '   ';
    output += `${marker} ${currentLine}: ${line}\n`;
  });
  
  output += '```\n';
  
  return output;
}
```

### Estrutura de Dados de Entrada

```typescript
interface ReportData {
  // Metadados
  ticket_id: string;
  timestamp: string;
  
  // Alerta original
  service_name: string;
  namespace: string;
  pod_name: string;
  error_message: string;
  stack_trace?: string;
  
  // Resultado da análise
  classification: 'infrastructure' | 'code' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'alta' | 'média' | 'baixa';
  
  // Conteúdo
  summary: string;
  root_cause: string;
  suggestions: string[];
  next_steps: string[];
  
  // Evidências
  kubernetes_evidence?: string;
  code_evidence?: string;
  network_evidence?: string;
  
  // URLs
  feedback_url: string;
}
```

## Critérios de Sucesso

- [ ] Relatório gerado em formato Markdown válido
- [ ] Ticket ID único (UUID) em cada relatório
- [ ] Todas as seções preenchidas corretamente
- [ ] Evidências de K8s formatadas de forma legível
- [ ] Código formatado com syntax highlighting
- [ ] NENHUM valor de secret presente no relatório
- [ ] Relatório renderiza corretamente em clientes de e-mail

## Referências

- PRD: F-006 (Geração de Relatório)
- Tech Spec: Seção "Estrutura do Relatório de Diagnóstico"
