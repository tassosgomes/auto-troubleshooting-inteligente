# Tech Spec: Auto-Troubleshooting Inteligente

## Resumo Executivo

Este documento detalha a arquitetura e implementação do sistema **Auto-Troubleshooting Inteligente**, um serviço autônomo de diagnóstico de incidentes L1/L2 baseado em IA.

A solução utiliza **n8n** como orquestrador de workflows, **MCP (Model Context Protocol)** para interação com Kubernetes e Git, e um **LLM** (Gemini 3.0 ou GPT 5.2) para análise inteligente. Os diagnósticos são persistidos em **PostgreSQL** e entregues via **SMTP** em formato Markdown. O deploy será feito via **Docker Compose** em um host Linux.

A arquitetura prioriza: (1) segurança (read-only, sem exposição de secrets), (2) resiliência (fallback para análise parcial), e (3) rastreabilidade (tickets UUID auditáveis).

---

## Arquitetura do Sistema

### Visão Geral dos Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOST LINUX (Docker Compose)                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │    n8n      │◄──►│ MCP Server  │    │ PostgreSQL  │    │    SMTP     │  │
│  │ (Workflow)  │    │ (K8s + Git) │    │  (Tickets)  │    │  (E-mail)   │  │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘    └─────────────┘  │
│         │                  │                                                │
│         │    ┌─────────────┴─────────────┐                                 │
│         │    │                           │                                 │
│         ▼    ▼                           ▼                                 │
│  ┌─────────────┐              ┌─────────────────────┐                      │
│  │   LLM API   │              │   Kubernetes API    │                      │
│  │(Gemini/GPT) │              │   (via kubeconfig)  │                      │
│  └─────────────┘              └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                                   │
         │ Webhook                           │ kubectl / git clone
         │                                   ▼
┌─────────────────┐              ┌─────────────────────┐
│  Elastic Stack  │              │  Git Repos (SSH)    │
│   (Alertas)     │              │  GitHub + Azure DO  │
└─────────────────┘              └─────────────────────┘
```

### Componentes e Responsabilidades

| Componente | Responsabilidade |
|------------|------------------|
| **n8n** | Orquestrador de workflows: recebe webhook, coordena análise, envia e-mail |
| **MCP Server** | Provê ferramentas para K8s (kubectl) e Git (clone/read) via protocolo MCP |
| **PostgreSQL** | Persiste tickets de diagnóstico para consulta e auditoria |
| **LLM API** | Analisa logs/código e gera diagnóstico (Gemini 3.0 ou GPT 5.2) |
| **SMTP** | Envia e-mails de diagnóstico |

---

## Design de Implementação

### Interfaces Principais

#### Webhook de Entrada (Elastic → n8n)

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

#### Estrutura de Annotation K8s

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  annotations:
    project.info/metadata: |
      {
        "repo_url": "git@github.com:empresa/order-service.git",
        "branch": "main",
        "owner_email": "dev@empresa.com",
        "language": "java"
      }
```

#### Interface MCP - Kubernetes Tools

```typescript
// Tools expostas pelo MCP Server para Kubernetes
interface KubernetesMCPTools {
  // Descreve um pod e retorna eventos
  describePod(namespace: string, podName: string): Promise<PodDescription>;
  
  // Lista eventos do namespace
  getEvents(namespace: string, podName?: string): Promise<Event[]>;
  
  // Obtém deployment e suas annotations
  getDeployment(namespace: string, deploymentName: string): Promise<Deployment>;
  
  // Verifica status de ConfigMaps (sem valores)
  getConfigMapKeys(namespace: string, configMapName: string): Promise<string[]>;
  
  // Verifica status de Secrets (apenas nomes de chaves)
  getSecretKeys(namespace: string, secretName: string): Promise<string[]>;
}
```

#### Interface MCP - Git Tools

```typescript
// Tools expostas pelo MCP Server para Git
interface GitMCPTools {
  // Clona repositório (shallow) e retorna path local
  cloneRepo(repoUrl: string, branch: string): Promise<string>;
  
  // Lê arquivo específico do repositório clonado
  readFile(repoPath: string, filePath: string): Promise<string>;
  
  // Lista arquivos em um diretório
  listFiles(repoPath: string, directory: string): Promise<string[]>;
  
  // Limpa repositório clonado
  cleanupRepo(repoPath: string): Promise<void>;
}
```

#### Interface MCP - Network Tools

```typescript
// Tools para teste de conectividade
interface NetworkMCPTools {
  // Executa requisição HTTP e retorna resultado
  httpRequest(url: string, method?: string, timeout?: number): Promise<HttpResult>;
}

interface HttpResult {
  status_code: number;
  response_time_ms: number;
  error?: string;
}
```

### Modelos de Dados

#### Ticket de Diagnóstico (PostgreSQL)

```sql
CREATE TABLE diagnosis_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados do alerta original
  service_name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  pod_name VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  alert_timestamp TIMESTAMP WITH TIME ZONE,
  alert_payload JSONB NOT NULL,
  
  -- Resultado da análise
  classification VARCHAR(50) NOT NULL, -- 'infrastructure', 'code', 'unknown'
  diagnosis_report TEXT NOT NULL,       -- Markdown completo
  root_cause TEXT,
  suggestions JSONB,                    -- Array de sugestões
  analysis_partial BOOLEAN DEFAULT FALSE,
  
  -- Metadados
  llm_model VARCHAR(100),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Feedback
  feedback_useful BOOLEAN,
  feedback_applied BOOLEAN,
  feedback_comment TEXT,
  feedback_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tickets_service ON diagnosis_tickets(service_name);
CREATE INDEX idx_tickets_created ON diagnosis_tickets(created_at);
CREATE INDEX idx_tickets_classification ON diagnosis_tickets(classification);
```

#### Estrutura do Relatório de Diagnóstico

```markdown
# 🔍 Diagnóstico de Incidente

**Ticket ID:** `{{ticket_id}}`  
**Data:** {{timestamp}}  
**Serviço:** {{service_name}}  
**Namespace:** {{namespace}}  

---

## 📋 Resumo Executivo

{{resumo_em_2_3_frases}}

## 🏷️ Classificação

| Campo | Valor |
|-------|-------|
| **Tipo** | {{infrastructure|code|unknown}} |
| **Severidade** | {{critical|high|medium|low}} |
| **Confiança** | {{alta|média|baixa}} |

---

## 🔎 Evidências Coletadas

### Erro Original
```
{{error_message}}
{{stack_trace}}
```

### Análise de Kubernetes
{{eventos_k8s_relevantes}}

### Análise de Código (se aplicável)
{{trecho_codigo_com_linha}}

---

## 🎯 Causa Raiz Identificada

{{descricao_da_causa_raiz}}

---

## 💡 Sugestões de Correção

1. {{sugestao_1}}
2. {{sugestao_2}}
3. {{sugestao_3}}

---

## ⏭️ Próximos Passos

- [ ] {{passo_1}}
- [ ] {{passo_2}}

---

*Este diagnóstico foi gerado automaticamente. Para análise adicional, use GitHub Copilot ou Claude Code.*

📧 [Dar feedback sobre este diagnóstico]({{feedback_url}})
```

### Endpoints de API

#### API de Consulta de Tickets

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/tickets/{id}` | Retorna ticket completo por UUID |
| `GET` | `/api/v1/tickets?service={name}` | Lista tickets por serviço |
| `POST` | `/api/v1/tickets/{id}/feedback` | Registra feedback do usuário |

```typescript
// GET /api/v1/tickets/{id}
interface TicketResponse {
  id: string;
  created_at: string;
  service_name: string;
  namespace: string;
  classification: 'infrastructure' | 'code' | 'unknown';
  diagnosis_report: string;
  root_cause: string | null;
  suggestions: string[];
  alert_payload: object;
}

// POST /api/v1/tickets/{id}/feedback
interface FeedbackRequest {
  useful: boolean;
  applied: boolean;
  comment?: string;
}
```

---

## Pontos de Integração

### Elastic Stack (Webhook de Alertas)

| Aspecto | Detalhe |
|---------|---------|
| **Protocolo** | HTTPS POST |
| **Autenticação** | Header `X-Webhook-Secret` (opcional) |
| **Payload** | JSON com campos obrigatórios definidos acima |
| **Tratamento de erro** | Retry com backoff exponencial (configurado no Elastic) |

### Kubernetes API

| Aspecto | Detalhe |
|---------|---------|
| **Autenticação** | kubeconfig local (`~/.kube/config`) |
| **Permissões (RBAC)** | ClusterRole read-only (ver seção de segurança) |
| **Tratamento de erro** | Log + continua análise sem dados K8s |

### Git (GitHub + Azure DevOps)

| Aspecto | Detalhe |
|---------|---------|
| **Protocolo** | SSH |
| **Autenticação** | Deploy Keys (read-only) em `~/.ssh/` |
| **Clone** | `git clone --depth 1 --branch {branch} {repo_url}` |
| **Cleanup** | Remove diretório após análise |
| **Tratamento de erro** | Fallback para análise apenas K8s |

### LLM API (Gemini/GPT)

| Aspecto | Detalhe |
|---------|---------|
| **Providers** | Gemini 3.0 (primário) ou GPT 5.2 (alternativo) |
| **Autenticação** | API Key via variável de ambiente |
| **Timeout** | 60 segundos |
| **Tratamento de erro** | Fallback: envia análise parcial + alerta original |

### SMTP

| Aspecto | Detalhe |
|---------|---------|
| **Protocolo** | SMTP/TLS |
| **Autenticação** | Usuário/senha via variáveis de ambiente |
| **Formato** | Markdown (text/plain com formatação) |
| **Tratamento de erro** | Retry 3x com intervalo de 5s |

---

## Análise de Impacto

| Componente Afetado | Tipo de Impacto | Descrição & Risco | Ação Requerida |
|--------------------|-----------------|-------------------|----------------|
| Elastic Stack | Configuração | Adicionar webhook connector. Baixo risco. | Configurar regra de alerta |
| Kubernetes RBAC | Nova Role | Criar ClusterRole read-only. Baixo risco. | Aplicar manifesto RBAC |
| Repositórios Git | Deploy Keys | Adicionar chaves SSH. Baixo risco. | Configurar em cada repo |
| Rede interna | Firewall | MCP precisa acessar K8s API. Médio risco. | Validar conectividade |
| Deployments K8s | Annotations | Adicionar `project.info/metadata`. Baixo risco. | Atualizar CI/CD |

---

## Abordagem de Testes

### Testes Unitários

| Componente | Cenários | Mocks |
|------------|----------|-------|
| Parser de webhook | Payload válido, campos faltando, JSON inválido | - |
| Classificador | Categorização correta por tipo de erro | LLM (resposta fixa) |
| Gerador de relatório | Template Markdown correto | - |
| Parser de annotations | JSON válido, ausente, malformado | K8s API |

### Testes de Integração

| Cenário | Componentes | Validação |
|---------|-------------|-----------|
| Fluxo OOMKilled | Webhook → n8n → MCP/K8s → LLM → Email | E-mail com diagnóstico infra |
| Fluxo NPE Java | Webhook → n8n → MCP/Git → LLM → Email | E-mail com linha de código |
| Fluxo timeout API | Webhook → n8n → MCP/curl → LLM → Email | E-mail com status HTTP |
| Fallback LLM | Webhook → n8n → LLM (timeout) → Email | E-mail com alerta original |
| Persistência | n8n → PostgreSQL | Ticket consultável via API |

### Dados de Teste

```json
// cenario_oomkilled.json
{
  "service_name": "payment-service",
  "namespace": "production",
  "pod_name": "payment-service-abc123",
  "error_message": "Container killed due to OOMKilled",
  "stack_trace": null
}

// cenario_npe.json
{
  "service_name": "order-service",
  "namespace": "production", 
  "pod_name": "order-service-xyz789",
  "error_message": "java.lang.NullPointerException",
  "stack_trace": "at com.example.OrderService.process(OrderService.java:42)\nat com.example.OrderController.handle(OrderController.java:28)"
}

// cenario_timeout.json
{
  "service_name": "inventory-service",
  "namespace": "production",
  "pod_name": "inventory-service-def456",
  "error_message": "Connection timeout to https://api.external.com/v1/stock",
  "stack_trace": "java.net.SocketTimeoutException: connect timed out"
}
```

---

## Sequenciamento de Desenvolvimento

### Ordem de Construção

| Fase | Componente | Justificativa | Estimativa |
|------|------------|---------------|------------|
| 1 | Docker Compose base | Infraestrutura necessária para tudo | 1 dia |
| 2 | PostgreSQL + schema | Persistência é core do sistema | 0.5 dia |
| 3 | n8n + webhook | Entrada de dados funcional | 1 dia |
| 4 | MCP Server K8s | Análise de infraestrutura | 2 dias |
| 5 | MCP Server Git | Análise de código | 2 dias |
| 6 | Integração LLM | Inteligência de diagnóstico | 2 dias |
| 7 | Gerador de relatório | Template Markdown | 1 dia |
| 8 | Envio de e-mail | Entrega ao usuário | 0.5 dia |
| 9 | API de consulta | Histórico de tickets | 1 dia |
| 10 | Fallback + resiliência | Produção-ready | 1 dia |
| 11 | Testes E2E | Validação dos 3 cenários | 2 dias |

**Total estimado:** ~14 dias de desenvolvimento

### Dependências Técnicas

| Dependência | Bloqueador? | Responsável |
|-------------|-------------|-------------|
| API key do LLM (Gemini/GPT) | Sim | Owner |
| kubeconfig com acesso ao cluster | Sim | Owner |
| Deploy keys nos repositórios | Sim | Owner |
| Credenciais SMTP | Sim | Owner |
| Annotations nos deployments | Não (pode testar com mock) | Times de produto |

---

## Monitoramento e Observabilidade

### Métricas (Prometheus)

```yaml
# Métricas expostas pelo sistema
- name: troubleshooting_alerts_received_total
  type: counter
  labels: [service_name, namespace]

- name: troubleshooting_diagnosis_duration_seconds
  type: histogram
  labels: [classification, llm_model]

- name: troubleshooting_diagnosis_classification_total
  type: counter
  labels: [classification]  # infrastructure, code, unknown

- name: troubleshooting_llm_tokens_used_total
  type: counter
  labels: [llm_model]

- name: troubleshooting_email_sent_total
  type: counter
  labels: [status]  # success, failed

- name: troubleshooting_fallback_triggered_total
  type: counter
  labels: [reason]  # llm_timeout, llm_error, git_error
```

### Logs

| Nível | Quando usar |
|-------|-------------|
| `ERROR` | Falha no LLM, falha no envio de e-mail, erro de conexão K8s |
| `WARN` | Fallback ativado, annotation ausente, análise parcial |
| `INFO` | Alerta recebido, diagnóstico concluído, e-mail enviado |
| `DEBUG` | Payloads completos, respostas do LLM, comandos kubectl |

### Alertas Sugeridos

| Alerta | Condição | Severidade |
|--------|----------|------------|
| Alta taxa de fallback | `rate(troubleshooting_fallback_triggered_total[5m]) > 0.2` | Warning |
| LLM indisponível | `troubleshooting_llm_errors_total` aumenta > 5/min | Critical |
| E-mails falhando | `troubleshooting_email_sent_total{status="failed"}` > 0 | Critical |

---

## Considerações Técnicas

### Decisões Principais

| Decisão | Escolha | Justificativa | Alternativas rejeitadas |
|---------|---------|---------------|------------------------|
| Orquestrador | n8n | Low-code, visual, extensível, suporte a AI agents | Temporal (complexo), Airflow (pesado) |
| Banco de dados | PostgreSQL | Robusto, JSONB para payloads flexíveis | SQLite (escala limitada), MongoDB (desnecessário) |
| Protocolo de IA | MCP | Padronizado, extensível, seguro | Custom API (retrabalho), LangChain (overhead) |
| Formato de relatório | Markdown | Universal, renderiza em e-mail, exportável | HTML (complexo), PDF (pesado) |
| Ticket ID | UUID | Único, não sequencial (segurança), padrão | Sequencial (previsível), Prefixado (complexidade) |

### Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| LLM gera diagnóstico incorreto | Média | Médio | Deixar claro que é sugestão; coletar feedback |
| LLM expõe secret no relatório | Baixa | Alto | Prompt com instrução explícita; pós-processamento |
| Stack trace ofuscado (ProGuard) | Média | Médio | Heurísticas alternativas; pedir mapeamento |
| Annotation ausente no deployment | Média | Médio | Fallback para análise apenas K8s |
| Custo de tokens elevado | Média | Baixo | Monitorar; otimizar contexto enviado |

### Requisitos Especiais

#### Segurança - RBAC Kubernetes

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: troubleshooting-reader
rules:
- apiGroups: [""]
  resources: ["pods", "events", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: troubleshooting-reader-binding
subjects:
- kind: ServiceAccount
  name: troubleshooting-sa
  namespace: troubleshooting
roleRef:
  kind: ClusterRole
  name: troubleshooting-reader
  apiGroup: rbac.authorization.k8s.io
```

#### Segurança - Prompt do LLM

```markdown
## INSTRUÇÕES DE SEGURANÇA (OBRIGATÓRIAS)

Você é um assistente de diagnóstico de incidentes. NUNCA inclua no relatório:
- Valores de variáveis de ambiente
- Valores de Secrets do Kubernetes
- Senhas, tokens, API keys ou credenciais
- Dados pessoais (PII)

Ao mencionar Secrets ou ConfigMaps, liste APENAS os nomes das chaves, NUNCA os valores.

Exemplo CORRETO: "O Secret `db-credentials` possui as chaves: username, password, host"
Exemplo INCORRETO: "O Secret `db-credentials` contém: username=admin, password=abc123"
```

---

## Estrutura de Diretórios do Projeto

```
auto-troubleshooting-inteligente/
├── docker-compose.yml              # Orquestração dos containers
├── .env.example                    # Template de variáveis de ambiente
├── n8n/
│   └── workflows/                  # Workflows exportados do n8n
│       └── troubleshooting.json
├── mcp-server/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── tools/
│   │   │   ├── kubernetes.ts      # Tools K8s
│   │   │   ├── git.ts             # Tools Git
│   │   │   └── network.ts         # Tools HTTP
│   │   └── prompts/
│   │       └── diagnosis.md       # System prompt do LLM
│   └── test/
├── api/
│   ├── Dockerfile
│   ├── src/
│   │   ├── routes/
│   │   │   └── tickets.ts
│   │   └── db/
│   │       └── schema.sql
│   └── test/
├── kubernetes/
│   ├── rbac.yaml                  # ClusterRole e binding
│   └── example-deployment.yaml    # Exemplo com annotations
├── docs/
│   ├── setup.md                   # Guia de instalação
│   └── troubleshooting.md         # FAQ
└── test/
    ├── integration/
    └── fixtures/
        ├── cenario_oomkilled.json
        ├── cenario_npe.json
        └── cenario_timeout.json
```

---

## Variáveis de Ambiente

```bash
# .env.example

# n8n
N8N_PORT=5678
N8N_WEBHOOK_URL=https://troubleshooting.empresa.com/webhook

# LLM
LLM_PROVIDER=gemini  # ou 'openai'
LLM_API_KEY=your-api-key-here
LLM_MODEL=gemini-3.0-pro  # ou 'gpt-5.2'
LLM_TIMEOUT_SECONDS=60

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=troubleshooting
POSTGRES_USER=troubleshooting
POSTGRES_PASSWORD=secure-password-here

# SMTP
SMTP_HOST=smtp.empresa.com
SMTP_PORT=587
SMTP_USER=troubleshooting@empresa.com
SMTP_PASSWORD=smtp-password-here
SMTP_FROM=Auto-Troubleshooting <troubleshooting@empresa.com>

# Kubernetes
KUBECONFIG=/home/app/.kube/config

# Git SSH
SSH_PRIVATE_KEY_PATH=/home/app/.ssh/id_rsa
```

---

*Tech Spec v1.0 | 2026-01-21 | PRD: Auto-Troubleshooting Inteligente*
