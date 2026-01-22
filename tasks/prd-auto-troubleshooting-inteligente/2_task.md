## status: done

<task_context>
<domain>infra/n8n</domain>
<type>integration</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>n8n, elastic</dependencies>
</task_context>

# Tarefa 2.0: Implementar Webhook n8n para Recepção de Alertas

## Visão Geral

Configurar o n8n para receber webhooks do Elastic Stack contendo alertas de erro. O workflow deve validar o payload, extrair campos obrigatórios e preparar os dados para as etapas seguintes de análise.

<requirements>
- Webhook HTTP funcional no n8n
- Validação de payload com campos obrigatórios
- Retorno de erro 400 para payloads inválidos
- Processamento em < 5 segundos
- Log de alertas recebidos
</requirements>

## Subtarefas

- [x] 2.1 Criar workflow base no n8n com nó Webhook
- [x] 2.2 Implementar validação de campos obrigatórios (service_name, error_message, pod_name, namespace)
- [x] 2.3 Configurar resposta de erro 400 para payload inválido
- [x] 2.4 Adicionar nó de log para rastreabilidade
- [x] 2.5 Exportar workflow como JSON para versionamento
- [x] 2.6 Testar webhook com payloads de exemplo (fixtures)

## Detalhes de Implementação

### Payload Esperado

```json
POST /webhook/alert
Content-Type: application/json

{
  "service_name": "order-service",
  "namespace": "production",
  "pod_name": "order-service-7d8f9c6b5-x2k4m",
  "error_message": "java.lang.NullPointerException",
  "stack_trace": "at com.example.OrderService.process(OrderService.java:42)...",
  "timestamp": "2026-01-21T10:30:00Z",
  "severity": "error"
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `service_name` | string | Nome do serviço que gerou o erro |
| `namespace` | string | Namespace Kubernetes |
| `pod_name` | string | Nome do pod |
| `error_message` | string | Mensagem de erro principal |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `stack_trace` | string | Stack trace completo |
| `timestamp` | ISO8601 | Timestamp do erro |
| `severity` | string | Nível de severidade |

### Fluxo do Workflow

```
[Webhook] → [Validação] → [Log] → [Próximas etapas...]
                ↓
           [Erro 400]
```

### Validação no n8n (Code Node)

```javascript
const required = ['service_name', 'namespace', 'pod_name', 'error_message'];
const missing = required.filter(field => !$input.first().json[field]);

if (missing.length > 0) {
  throw new Error(`Campos obrigatórios faltando: ${missing.join(', ')}`);
}

return $input.all();
```

## Critérios de Sucesso

- [x] Webhook responde em `/webhook/alert` via POST
- [x] Payload válido retorna status 200
- [x] Payload sem campos obrigatórios retorna status 400 com mensagem clara
- [x] Tempo de processamento do webhook < 5 segundos
- [x] Workflow exportado em `n8n/workflows/troubleshooting.json`
- [x] Testes com os 3 fixtures (OOMKilled, NPE, Timeout) passam

## Referências

- PRD: F-001 (Recepção de Alertas via Webhook)
- Tech Spec: Seção "Webhook de Entrada"
