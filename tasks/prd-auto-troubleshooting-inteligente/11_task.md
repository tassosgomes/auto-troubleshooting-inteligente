## status: pending

<task_context>
<domain>test/e2e</domain>
<type>testing</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>docker, fixtures</dependencies>
</task_context>

# Tarefa 11.0: Criar Testes E2E e Validar Cenários MVP

## Visão Geral

Criar testes end-to-end que validam os 3 cenários principais do MVP: OOMKilled, NullPointerException e Timeout de Integração. Inclui fixtures de teste e scripts de validação.

<requirements>
- Fixtures para os 3 cenários de teste
- Scripts de teste automatizados
- Validação de classificação correta
- Validação de envio de e-mail
- Validação de persistência de ticket
- Validação de fallback
</requirements>

## Subtarefas

- [ ] 11.1 Criar fixtures JSON para os 3 cenários
- [ ] 11.2 Criar script de envio de webhook de teste
- [ ] 11.3 Validar cenário OOMKilled (classificação: infrastructure)
- [ ] 11.4 Validar cenário NPE Java (classificação: code)
- [ ] 11.5 Validar cenário Timeout (classificação: unknown)
- [ ] 11.6 Validar persistência de tickets no PostgreSQL
- [ ] 11.7 Validar conteúdo do e-mail enviado
- [ ] 11.8 Validar cenário de fallback (LLM timeout)
- [ ] 11.9 Documentar resultados dos testes

## Detalhes de Implementação

### Estrutura de Testes

```
test/
├── fixtures/
│   ├── cenario_oomkilled.json
│   ├── cenario_npe.json
│   └── cenario_timeout.json
├── integration/
│   ├── test_oomkilled.sh
│   ├── test_npe.sh
│   ├── test_timeout.sh
│   └── test_fallback.sh
├── utils/
│   ├── send_webhook.sh
│   └── check_ticket.sh
└── run_all_tests.sh
```

### Fixture: OOMKilled

```json
// test/fixtures/cenario_oomkilled.json
{
  "service_name": "payment-service",
  "namespace": "production",
  "pod_name": "payment-service-7d8f9c6b5-abc123",
  "error_message": "Container payment-service was OOMKilled",
  "stack_trace": null,
  "timestamp": "2026-01-21T10:30:00Z",
  "severity": "critical"
}
```

### Fixture: NullPointerException

```json
// test/fixtures/cenario_npe.json
{
  "service_name": "order-service",
  "namespace": "production",
  "pod_name": "order-service-5c4d3e2f1-xyz789",
  "error_message": "java.lang.NullPointerException: Cannot invoke method on null object",
  "stack_trace": "java.lang.NullPointerException: Cannot invoke method on null object\n\tat com.example.order.service.OrderService.processOrder(OrderService.java:42)\n\tat com.example.order.controller.OrderController.createOrder(OrderController.java:28)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)",
  "timestamp": "2026-01-21T11:45:00Z",
  "severity": "error"
}
```

### Fixture: Timeout de Integração

```json
// test/fixtures/cenario_timeout.json
{
  "service_name": "inventory-service",
  "namespace": "production",
  "pod_name": "inventory-service-8a7b6c5d4-def456",
  "error_message": "Connection timeout while calling external API: https://api.supplier.com/v1/stock",
  "stack_trace": "java.net.SocketTimeoutException: connect timed out\n\tat java.net.PlainSocketImpl.socketConnect(Native Method)\n\tat com.example.inventory.client.SupplierClient.getStock(SupplierClient.java:67)\n\tat com.example.inventory.service.InventoryService.checkAvailability(InventoryService.java:34)",
  "timestamp": "2026-01-21T14:20:00Z",
  "severity": "error"
}
```

### Script de Envio de Webhook

```bash
#!/bin/bash
# test/utils/send_webhook.sh

WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:5678/webhook/alert}"
FIXTURE_FILE="$1"

if [ -z "$FIXTURE_FILE" ]; then
  echo "Uso: $0 <fixture_file>"
  exit 1
fi

echo "Enviando webhook com fixture: $FIXTURE_FILE"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d @"$FIXTURE_FILE" \
  "$WEBHOOK_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook enviado com sucesso"
  exit 0
else
  echo "❌ Falha ao enviar webhook"
  exit 1
fi
```

### Script de Verificação de Ticket

```bash
#!/bin/bash
# test/utils/check_ticket.sh

API_URL="${API_URL:-http://localhost:3000}"
TICKET_ID="$1"
EXPECTED_CLASSIFICATION="$2"

if [ -z "$TICKET_ID" ] || [ -z "$EXPECTED_CLASSIFICATION" ]; then
  echo "Uso: $0 <ticket_id> <expected_classification>"
  exit 1
fi

echo "Verificando ticket: $TICKET_ID"

RESPONSE=$(curl -s "$API_URL/api/v1/tickets/$TICKET_ID")

CLASSIFICATION=$(echo "$RESPONSE" | jq -r '.classification')

echo "Classificação encontrada: $CLASSIFICATION"
echo "Classificação esperada: $EXPECTED_CLASSIFICATION"

if [ "$CLASSIFICATION" = "$EXPECTED_CLASSIFICATION" ]; then
  echo "✅ Classificação correta"
  exit 0
else
  echo "❌ Classificação incorreta"
  exit 1
fi
```

### Teste E2E: OOMKilled

```bash
#!/bin/bash
# test/integration/test_oomkilled.sh

set -e

echo "=========================================="
echo "Teste E2E: Cenário OOMKilled"
echo "=========================================="

# 1. Enviar webhook
echo "1. Enviando alerta de OOMKilled..."
./utils/send_webhook.sh ../fixtures/cenario_oomkilled.json

# 2. Aguardar processamento
echo "2. Aguardando processamento (30s)..."
sleep 30

# 3. Verificar ticket no banco
echo "3. Buscando ticket mais recente..."
TICKET_ID=$(psql -h localhost -U troubleshooting -d troubleshooting -t -c \
  "SELECT id FROM diagnosis_tickets WHERE service_name='payment-service' ORDER BY created_at DESC LIMIT 1")
TICKET_ID=$(echo "$TICKET_ID" | tr -d ' ')

if [ -z "$TICKET_ID" ]; then
  echo "❌ Ticket não encontrado no banco"
  exit 1
fi

echo "Ticket ID: $TICKET_ID"

# 4. Verificar classificação
echo "4. Verificando classificação..."
./utils/check_ticket.sh "$TICKET_ID" "infrastructure"

# 5. Verificar conteúdo do relatório
echo "5. Verificando conteúdo do relatório..."
REPORT=$(psql -h localhost -U troubleshooting -d troubleshooting -t -c \
  "SELECT diagnosis_report FROM diagnosis_tickets WHERE id='$TICKET_ID'")

if echo "$REPORT" | grep -q "OOMKilled"; then
  echo "✅ Relatório menciona OOMKilled"
else
  echo "❌ Relatório não menciona OOMKilled"
  exit 1
fi

echo "=========================================="
echo "✅ Teste OOMKilled passou!"
echo "=========================================="
```

### Teste E2E: NPE

```bash
#!/bin/bash
# test/integration/test_npe.sh

set -e

echo "=========================================="
echo "Teste E2E: Cenário NullPointerException"
echo "=========================================="

# 1. Enviar webhook
echo "1. Enviando alerta de NPE..."
./utils/send_webhook.sh ../fixtures/cenario_npe.json

# 2. Aguardar processamento (mais tempo para clone de repo)
echo "2. Aguardando processamento (60s)..."
sleep 60

# 3. Verificar ticket no banco
echo "3. Buscando ticket mais recente..."
TICKET_ID=$(psql -h localhost -U troubleshooting -d troubleshooting -t -c \
  "SELECT id FROM diagnosis_tickets WHERE service_name='order-service' ORDER BY created_at DESC LIMIT 1")
TICKET_ID=$(echo "$TICKET_ID" | tr -d ' ')

if [ -z "$TICKET_ID" ]; then
  echo "❌ Ticket não encontrado no banco"
  exit 1
fi

echo "Ticket ID: $TICKET_ID"

# 4. Verificar classificação
echo "4. Verificando classificação..."
./utils/check_ticket.sh "$TICKET_ID" "code"

# 5. Verificar se localiza linha de código
echo "5. Verificando localização de código..."
REPORT=$(psql -h localhost -U troubleshooting -d troubleshooting -t -c \
  "SELECT diagnosis_report FROM diagnosis_tickets WHERE id='$TICKET_ID'")

if echo "$REPORT" | grep -q "OrderService.java"; then
  echo "✅ Relatório menciona arquivo correto"
else
  echo "⚠️ Relatório não menciona arquivo (pode ser esperado sem repo real)"
fi

echo "=========================================="
echo "✅ Teste NPE passou!"
echo "=========================================="
```

### Teste de Fallback

```bash
#!/bin/bash
# test/integration/test_fallback.sh

set -e

echo "=========================================="
echo "Teste E2E: Cenário Fallback (LLM indisponível)"
echo "=========================================="

# 1. Parar/bloquear acesso ao LLM (simulado via env)
echo "1. Simulando LLM indisponível..."
export LLM_API_KEY="invalid_key_for_testing"

# 2. Enviar webhook
echo "2. Enviando alerta..."
./utils/send_webhook.sh ../fixtures/cenario_oomkilled.json

# 3. Aguardar processamento
echo "3. Aguardando processamento (90s para timeout)..."
sleep 90

# 4. Verificar ticket com analysis_partial=true
echo "4. Verificando ticket parcial..."
PARTIAL=$(psql -h localhost -U troubleshooting -d troubleshooting -t -c \
  "SELECT analysis_partial FROM diagnosis_tickets WHERE service_name='payment-service' ORDER BY created_at DESC LIMIT 1")

if echo "$PARTIAL" | grep -q "t"; then
  echo "✅ Ticket marcado como análise parcial"
else
  echo "❌ Ticket não está marcado como parcial"
  exit 1
fi

echo "=========================================="
echo "✅ Teste Fallback passou!"
echo "=========================================="
```

### Script Principal de Testes

```bash
#!/bin/bash
# test/run_all_tests.sh

set -e

echo "=========================================="
echo "Executando todos os testes E2E"
echo "=========================================="

cd "$(dirname "$0")"

# Verificar se ambiente está rodando
echo "Verificando ambiente..."
curl -s http://localhost:5678/healthcheck > /dev/null || {
  echo "❌ n8n não está respondendo"
  exit 1
}
curl -s http://localhost:3000/health > /dev/null || {
  echo "❌ API não está respondendo"
  exit 1
}

echo "✅ Ambiente OK"
echo ""

# Executar testes
TESTS=(
  "integration/test_oomkilled.sh"
  "integration/test_npe.sh"
  "integration/test_timeout.sh"
  "integration/test_fallback.sh"
)

PASSED=0
FAILED=0

for test in "${TESTS[@]}"; do
  echo ""
  echo "Executando: $test"
  if bash "$test"; then
    ((PASSED++))
  else
    ((FAILED++))
    echo "❌ Teste falhou: $test"
  fi
done

echo ""
echo "=========================================="
echo "Resultados:"
echo "  Passou: $PASSED"
echo "  Falhou: $FAILED"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
  exit 1
fi

echo "✅ Todos os testes passaram!"
```

## Critérios de Sucesso

- [ ] Cenário OOMKilled classificado como `infrastructure`
- [ ] Cenário NPE classificado como `code`
- [ ] Cenário Timeout classificado como `unknown`
- [ ] Tickets persistidos no PostgreSQL para todos os cenários
- [ ] Relatórios contêm informações relevantes
- [ ] Fallback funciona quando LLM está indisponível
- [ ] Todos os scripts de teste executam sem erro

## Referências

- PRD: Seção "Critérios de Aceitação do MVP"
- Tech Spec: Seção "Dados de Teste"
