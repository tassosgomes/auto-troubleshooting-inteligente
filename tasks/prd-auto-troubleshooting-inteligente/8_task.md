## status: completed

<task_context>
<domain>n8n/email</domain>
<type>integration</type>
<scope>core_feature</scope>
<complexity>low</complexity>
<dependencies>n8n, smtp</dependencies>
</task_context>

# Tarefa 8.0: Configurar Envio de E-mail via SMTP

## Visão Geral

Configurar o envio de e-mails com o relatório de diagnóstico via SMTP corporativo. O e-mail deve conter o Ticket ID, resumo e relatório completo em formato Markdown.

<requirements>
- Envio via SMTP com TLS
- Destinatário extraído de annotation K8s
- Formato text/plain (Markdown)
- Entrega em < 2 minutos após análise
- Retry em caso de falha
</requirements>

## Subtarefas

- [x] 8.1 Configurar credenciais SMTP no n8n
- [x] 8.2 Criar nó de envio de e-mail no workflow
- [x] 8.3 Configurar assunto com Ticket ID e serviço
- [x] 8.4 Configurar corpo com relatório Markdown
- [x] 8.5 Extrair destinatário de `project.info/metadata`
- [x] 8.6 Implementar retry (3x com intervalo de 5s)
- [x] 8.7 Testar envio com SMTP de desenvolvimento

## Detalhes de Implementação

### Configuração SMTP no n8n

```javascript
// Variáveis de ambiente necessárias
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
```

### Template do E-mail

**Assunto:**
```
[Auto-Troubleshooting] {{classification | upper}} - {{service_name}} - Ticket {{ticket_id | truncate(8)}}
```

**Corpo:**
```markdown
# Diagnóstico Automático

**Ticket ID:** {{ticket_id}}
**Serviço:** {{service_name}}
**Namespace:** {{namespace}}
**Classificação:** {{classification}}

---

## Resumo

{{summary}}

---

## Relatório Completo

{{diagnosis_report}}

---

📧 Para dar feedback sobre este diagnóstico, acesse:
{{feedback_url}}

---

*Este é um e-mail automático do sistema Auto-Troubleshooting Inteligente.*
*Não responda a este e-mail.*
```

### Extração do Destinatário

```javascript
// No workflow n8n, após obter o deployment:
// A annotation project.info/metadata contém o owner_email

const metadata = JSON.parse(deployment.annotations['project.info/metadata']);
const ownerEmail = metadata.owner_email;

if (!ownerEmail) {
  // Fallback para e-mail padrão configurado
  return process.env.DEFAULT_ALERT_EMAIL || 'devops@empresa.com';
}

return ownerEmail;
```

### Configuração do Nó Email no n8n

```json
{
  "node": "Email Send",
  "parameters": {
    "fromEmail": "={{$env.SMTP_FROM}}",
    "toEmail": "={{$json.owner_email}}",
    "subject": "[Auto-Troubleshooting] {{$json.classification}} - {{$json.service_name}} - Ticket {{$json.ticket_id.slice(0,8)}}",
    "text": "={{$json.email_body}}",
    "options": {
      "appendAttribution": false
    }
  },
  "credentials": {
    "smtp": "SMTP Corporativo"
  }
}
```

### Retry Logic

```javascript
// Implementar no workflow com nó "Error Trigger" ou "Retry on Error"
// Configuração:
// - Máximo de tentativas: 3
// - Intervalo entre tentativas: 5 segundos
// - Backoff: linear

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 5000;

async function sendEmailWithRetry(emailData, attempt = 1) {
  try {
    await sendEmail(emailData);
    return { success: true };
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_INTERVAL_MS);
      return sendEmailWithRetry(emailData, attempt + 1);
    }
    throw new Error(`Falha ao enviar e-mail após ${MAX_RETRIES} tentativas: ${error.message}`);
  }
}
```

### Fluxo no Workflow

```
[Gerar Relatório]
    ↓
[Salvar no PostgreSQL] → [Ticket ID gerado]
    ↓
[Obter owner_email da annotation]
    ↓
[Montar E-mail]
    ↓
[Enviar E-mail] ─── erro ──► [Retry 3x]
    ↓                              ↓
[Sucesso]                    [Log de Erro]
```

## Critérios de Sucesso

- [ ] E-mail enviado com sucesso via SMTP
- [ ] Assunto contém classificação, serviço e Ticket ID
- [ ] Corpo contém relatório completo em Markdown
- [ ] Destinatário correto extraído de annotation
- [ ] Entrega em < 2 minutos após análise
- [ ] Retry funciona em caso de falha temporária
- [ ] E-mail legível em clientes text/plain

## Referências

- PRD: F-007 (Envio de E-mail)
- Tech Spec: Seção "SMTP"

## Checklist de Conclusão

- [x] 8.0 Configurar Envio de E-mail via SMTP ✅ CONCLUÍDA
  - [x] 8.1 Implementação completada
  - [x] 8.2 Definição da tarefa, PRD e tech spec validados
  - [x] 8.3 Análise de regras e conformidade verificadas
  - [x] 8.4 Revisão de código completada
  - [x] 8.5 Pronto para deploy
