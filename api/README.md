# API de Consulta de Tickets

API REST para consulta de tickets de diagnóstico e registro de feedback.

## Variáveis de ambiente

- `API_PORT` (default: `3000`)
- `POSTGRES_HOST` (default: `localhost`)
- `POSTGRES_PORT` (default: `5432`)
- `POSTGRES_DB` (default: `troubleshooting`)
- `POSTGRES_USER` (default: `troubleshooting`)
- `POSTGRES_PASSWORD` (default: `change-me-in-production`)

## Endpoints

### Health check

- `GET /health`

### Buscar ticket por ID

- `GET /api/v1/tickets/{id}`

Exemplo:

```bash
curl -s http://localhost:3000/api/v1/tickets/00000000-0000-0000-0000-000000000000
```

### Listar tickets por serviço

- `GET /api/v1/tickets?service={name}`
- Paginação opcional: `limit` e `offset`
- Compatível também com `_page` e `_size`

Resposta (exemplo):

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "size": 10,
    "total": 0,
    "totalPages": 1
  }
}
```

Exemplo:

```bash
curl -s "http://localhost:3000/api/v1/tickets?service=payment-service&limit=10&offset=0"
```

### Registrar feedback

- `POST /api/v1/tickets/{id}/feedback`

Exemplo:

```bash
curl -s -X POST http://localhost:3000/api/v1/tickets/00000000-0000-0000-0000-000000000000/feedback \
  -H "Content-Type: application/json" \
  -d '{"useful": true, "applied": false, "comment": "Diagnóstico claro."}'
```

## Execução local

```bash
npm install
npm run build
API_PORT=3000 npm run start
```
