## status: completed

<task_context>
<domain>api/tickets</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>medium</complexity>
<dependencies>express, postgresql</dependencies>
</task_context>

# Tarefa 9.0: Implementar API de Consulta de Tickets

## Visão Geral

Criar uma API REST simples para consulta de tickets de diagnóstico e registro de feedback. Permite que desenvolvedores consultem histórico de diagnósticos pelo Ticket ID.

<requirements>
- GET /api/v1/tickets/{id} - Retorna ticket por UUID
- GET /api/v1/tickets?service={name} - Lista tickets por serviço
- POST /api/v1/tickets/{id}/feedback - Registra feedback
- Integração com PostgreSQL
- Documentação básica
</requirements>

## Subtarefas

- [x] 9.1 Criar projeto Node.js/Express para API
- [x] 9.2 Configurar conexão com PostgreSQL
- [x] 9.3 Implementar GET /api/v1/tickets/{id}
- [x] 9.4 Implementar GET /api/v1/tickets?service={name}
- [x] 9.5 Implementar POST /api/v1/tickets/{id}/feedback
- [x] 9.6 Criar Dockerfile para a API
- [x] 9.7 Adicionar ao docker-compose.yml
- [x] 9.8 Criar documentação básica dos endpoints
- [x] 9.9 Testar endpoints com dados de exemplo

## Detalhes de Implementação

### Estrutura do Projeto

```
api/
├── Dockerfile
├── package.json
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── tickets.ts
│   ├── db/
│   │   ├── schema.sql
│   │   └── connection.ts
│   └── types/
│       └── ticket.ts
└── test/
    └── tickets.test.ts
```

### Tipos TypeScript

```typescript
// src/types/ticket.ts

export interface Ticket {
  id: string;
  created_at: string;
  updated_at: string;
  service_name: string;
  namespace: string;
  pod_name: string;
  error_message: string;
  stack_trace: string | null;
  alert_timestamp: string | null;
  alert_payload: object;
  classification: 'infrastructure' | 'code' | 'unknown';
  diagnosis_report: string;
  root_cause: string | null;
  suggestions: string[];
  analysis_partial: boolean;
  llm_model: string | null;
  tokens_used: number | null;
  processing_time_ms: number | null;
  feedback_useful: boolean | null;
  feedback_applied: boolean | null;
  feedback_comment: string | null;
  feedback_at: string | null;
}

export interface TicketResponse {
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

export interface FeedbackRequest {
  useful: boolean;
  applied: boolean;
  comment?: string;
}
```

### Rotas

```typescript
// src/routes/tickets.ts

import { Router } from 'express';
import { Pool } from 'pg';

const router = Router();

// GET /api/v1/tickets/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Validar UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const result = await pool.query(
    `SELECT id, created_at, service_name, namespace, classification, 
            diagnosis_report, root_cause, suggestions, alert_payload
     FROM diagnosis_tickets WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Ticket não encontrado' });
  }

  res.json(result.rows[0]);
});

// GET /api/v1/tickets?service={name}
router.get('/', async (req, res) => {
  const { service, limit = 20, offset = 0 } = req.query;

  let query = `
    SELECT id, created_at, service_name, namespace, classification, root_cause
    FROM diagnosis_tickets
  `;
  const params: any[] = [];

  if (service) {
    query += ` WHERE service_name = $1`;
    params.push(service);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// POST /api/v1/tickets/:id/feedback
router.post('/:id/feedback', async (req, res) => {
  const { id } = req.params;
  const { useful, applied, comment } = req.body;

  // Validar campos obrigatórios
  if (typeof useful !== 'boolean' || typeof applied !== 'boolean') {
    return res.status(400).json({ error: 'Campos useful e applied são obrigatórios (boolean)' });
  }

  const result = await pool.query(
    `UPDATE diagnosis_tickets 
     SET feedback_useful = $1, feedback_applied = $2, feedback_comment = $3, 
         feedback_at = NOW(), updated_at = NOW()
     WHERE id = $4
     RETURNING id`,
    [useful, applied, comment || null, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Ticket não encontrado' });
  }

  res.json({ success: true, message: 'Feedback registrado' });
});

export default router;
```

### Entry Point

```typescript
// src/index.ts

import express from 'express';
import ticketsRouter from './routes/tickets';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Rotas
app.use('/api/v1/tickets', ticketsRouter);

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
```

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose (adicionar)

```yaml
  api:
    build: ./api
    restart: unless-stopped
    ports:
      - "${API_PORT}:3000"
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    depends_on:
      - postgres
```

## Critérios de Sucesso

- [ ] GET /api/v1/tickets/{id} retorna ticket completo
- [ ] GET /api/v1/tickets/{id} retorna 404 para ID inexistente
- [ ] GET /api/v1/tickets?service={name} filtra por serviço
- [ ] POST /api/v1/tickets/{id}/feedback registra feedback
- [ ] Validação de UUID funciona
- [ ] API roda em container Docker
- [ ] Health check em /health funciona

## Referências

- PRD: F-008 (Armazenamento e Consulta), F-009 (Feedback)
- Tech Spec: Seção "Endpoints de API"
