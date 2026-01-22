## status: completed

<task_context>
<domain>infra/docker</domain>
<type>configuration</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>docker, postgresql</dependencies>
</task_context>

# Tarefa 1.0: Configurar Infraestrutura Base (Docker Compose + PostgreSQL)

## Visão Geral

Criar a estrutura base do projeto com Docker Compose orquestrando os containers necessários: n8n, PostgreSQL, e preparação para MCP Server. Inclui criação do schema do banco de dados para tickets de diagnóstico.

<requirements>
- Docker Compose funcional com todos os serviços
- PostgreSQL com schema de tickets criado
- Variáveis de ambiente configuráveis via .env
- Volumes persistentes para dados
- Restart automático dos containers
</requirements>

## Subtarefas

- [x] 1.1 Criar estrutura de diretórios do projeto
- [x] 1.2 Criar arquivo docker-compose.yml com serviços base
- [x] 1.3 Criar .env.example com todas as variáveis necessárias
- [x] 1.4 Criar schema SQL do PostgreSQL (tabela diagnosis_tickets)
- [x] 1.5 Configurar volume persistente para PostgreSQL
- [x] 1.6 Testar subida do ambiente com `docker-compose up`

## Detalhes de Implementação

### Estrutura de Diretórios

```
auto-troubleshooting-inteligente/
├── docker-compose.yml
├── .env.example
├── n8n/
│   └── workflows/
├── mcp-server/
│   ├── Dockerfile
│   └── src/
├── api/
│   ├── Dockerfile
│   └── src/
│       └── db/
│           └── schema.sql
├── kubernetes/
└── test/
    └── fixtures/
```

### Schema PostgreSQL

```sql
CREATE TABLE diagnosis_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  service_name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  pod_name VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  alert_timestamp TIMESTAMP WITH TIME ZONE,
  alert_payload JSONB NOT NULL,
  classification VARCHAR(50) NOT NULL,
  diagnosis_report TEXT NOT NULL,
  root_cause TEXT,
  suggestions JSONB,
  analysis_partial BOOLEAN DEFAULT FALSE,
  llm_model VARCHAR(100),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  feedback_useful BOOLEAN,
  feedback_applied BOOLEAN,
  feedback_comment TEXT,
  feedback_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tickets_service ON diagnosis_tickets(service_name);
CREATE INDEX idx_tickets_created ON diagnosis_tickets(created_at);
CREATE INDEX idx_tickets_classification ON diagnosis_tickets(classification);
```

### Docker Compose Base

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./api/src/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "${N8N_PORT}:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}

volumes:
  postgres_data:
  n8n_data:
```

## Critérios de Sucesso

- [ ] `docker-compose up -d` inicia todos os serviços sem erro
- [ ] PostgreSQL acessível na porta 5432 com tabela `diagnosis_tickets` criada
- [ ] n8n acessível em http://localhost:5678
- [ ] Dados persistem após `docker-compose down` e `up`
- [ ] Containers reiniciam automaticamente após falha

## Checklist de Conclusão

- [x] 1.0 Configurar Infraestrutura Base (Docker Compose + PostgreSQL) ✅ CONCLUÍDA
  - [x] 1.1 Implementação completada
  - [x] 1.2 Definição da tarefa, PRD e tech spec validados
  - [x] 1.3 Análise de regras e conformidade verificadas
  - [x] 1.4 Revisão de código completada
  - [x] 1.5 Pronto para deploy

## Referências

- PRD: Seção "Infraestrutura"
- Tech Spec: Seção "Estrutura de Diretórios" e "Variáveis de Ambiente"
