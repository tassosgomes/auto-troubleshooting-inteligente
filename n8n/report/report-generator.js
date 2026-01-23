const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Handlebars = require('handlebars');

const TEMPLATE_PATH = path.join(__dirname, 'diagnostic-report.hbs');

const SENSITIVE_KEY_PATTERN = /(password|pass|pwd|secret|token|api[_-]?key|authorization|private[_-]?key|client_secret|access[_-]?token|refresh[_-]?token)/i;
const ENV_SENSITIVE_KEY_PATTERN = /(PASSWORD|PASS|PWD|SECRET|TOKEN|API[_-]?KEY|AUTHORIZATION|PRIVATE[_-]?KEY|CLIENT_SECRET|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN)/i;

Handlebars.registerHelper('increment', (index) => Number(index) + 1);

function sanitizeText(text) {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  let sanitized = text;

  sanitized = sanitized.replace(
    /("?(?:password|pass|pwd|secret|token|api[_-]?key|authorization|private[_-]?key|client_secret|access[_-]?token|refresh[_-]?token)"?\s*[:=]\s*)("?)[^"\s,;]+("?)/gi,
    '$1[REDACTED]'
  );

  sanitized = sanitized.replace(
    /((?:PASSWORD|PASS|PWD|SECRET|TOKEN|API[_-]?KEY|AUTHORIZATION|PRIVATE[_-]?KEY|CLIENT_SECRET|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN)\s*=\s*)([^\s]+)/gi,
    '$1[REDACTED]'
  );

  return sanitized;
}

function sanitizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitizeText(entry)).filter(Boolean);
}

function sanitizeObjectValues(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const output = Array.isArray(obj) ? [] : {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) || ENV_SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : sanitizeText(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => sanitizeObjectValues(item));
    } else if (value && typeof value === 'object') {
      output[key] = sanitizeObjectValues(value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

function formatKubernetesEvidence(podDescription, events) {
  if (!podDescription && !events) return '';

  let output = '';
  if (podDescription?.name) {
    output += `**Pod:** ${sanitizeText(podDescription.name)}\n`;
  }
  if (podDescription?.status) {
    output += `**Status:** ${sanitizeText(podDescription.status)}\n\n`;
  }

  if (podDescription?.containerStatuses?.length) {
    output += '**Containers:**\n';
    for (const container of podDescription.containerStatuses) {
      const readyLabel = container.ready ? '✅ Ready' : '❌ Not Ready';
      output += `- ${sanitizeText(container.name)}: ${readyLabel}`;
      if (Number.isFinite(container.restartCount)) {
        output += ` (Restarts: ${container.restartCount})`;
      }
      output += '\n';

      if (container.state?.terminated) {
        output += `  - Terminated: ${sanitizeText(container.state.terminated.reason)}\n`;
      }
      if (container.state?.waiting) {
        output += `  - Waiting: ${sanitizeText(container.state.waiting.reason)}\n`;
      }
    }
  }

  if (events?.length) {
    output += '\n**Eventos Recentes:**\n';
    const recentEvents = events.slice(-5);
    for (const event of recentEvents) {
      const icon = event.type === 'Warning' ? '⚠️' : 'ℹ️';
      output += `${icon} [${sanitizeText(event.reason)}] ${sanitizeText(event.message)}\n`;
    }
  }

  return output.trim();
}

function formatCodeEvidence(filePath, lineNumber, codeSnippet, language = '') {
  if (!codeSnippet) return '';

  const lines = String(codeSnippet).split('\n');
  const safeLineNumber = Number(lineNumber) || 1;
  const startLine = Math.max(1, safeLineNumber - 5);

  let output = `**Arquivo:** \`${sanitizeText(filePath || 'arquivo desconhecido')}\`\n`;
  output += `**Linha:** ${safeLineNumber}\n\n`;
  output += `\`\`\`${sanitizeText(language)}\n`;

  lines.forEach((line, index) => {
    const currentLine = startLine + index;
    const marker = currentLine === safeLineNumber ? '>>>' : '   ';
    output += `${marker} ${currentLine}: ${sanitizeText(line)}\n`;
  });

  output += '\`\`\`\n';

  return output.trim();
}

function formatNetworkEvidence(networkInfo) {
  if (!networkInfo) return '';
  if (typeof networkInfo === 'string') return sanitizeText(networkInfo);

  const details = sanitizeObjectValues(networkInfo);
  const url = details.url ? `**URL:** ${details.url}\n` : '';
  const status = details.status_code ? `**Status:** ${details.status_code}\n` : '';
  const responseTime = details.response_time_ms
    ? `**Tempo de resposta:** ${details.response_time_ms}ms\n`
    : '';
  const error = details.error ? `**Erro:** ${details.error}\n` : '';

  return `${url}${status}${responseTime}${error}`.trim();
}

function normalizeClassification(value) {
  const normalized = String(value || 'unknown').toLowerCase();
  return ['infrastructure', 'code', 'unknown'].includes(normalized)
    ? normalized
    : 'unknown';
}

function normalizeSeverity(value) {
  const normalized = String(value || 'medium').toLowerCase();
  return ['critical', 'high', 'medium', 'low'].includes(normalized)
    ? normalized
    : 'medium';
}

function normalizeConfidence(value) {
  const normalized = String(value || 'média').toLowerCase();
  return ['alta', 'média', 'baixa'].includes(normalized)
    ? normalized
    : 'média';
}

function buildReportData(input) {
  const sanitizedInput = sanitizeObjectValues(input || {});
  const ticketId = sanitizedInput.ticket_id || sanitizedInput.ticketId || randomUUID();
  const timestamp = sanitizedInput.timestamp || new Date().toISOString();

  const podDescription = sanitizedInput.pod_description
    || sanitizedInput.kubernetes_pod_description
    || sanitizedInput.kubernetes?.podDescription
    || sanitizedInput.kubernetes?.pod
    || null;

  const events = sanitizedInput.events
    || sanitizedInput.kubernetes_events
    || sanitizedInput.kubernetes?.events
    || null;

  const kubernetesEvidence = sanitizedInput.kubernetes_evidence
    || formatKubernetesEvidence(podDescription, events);

  const codeEvidenceDetail = sanitizedInput.code_evidence_detail
    || sanitizedInput.code
    || null;

  const codeEvidence = typeof sanitizedInput.code_evidence === 'string'
    ? sanitizedInput.code_evidence
    : (codeEvidenceDetail
      ? formatCodeEvidence(
        codeEvidenceDetail.filePath || codeEvidenceDetail.file_path,
        codeEvidenceDetail.lineNumber || codeEvidenceDetail.line_number,
        codeEvidenceDetail.codeSnippet || codeEvidenceDetail.code_snippet,
        codeEvidenceDetail.language || codeEvidenceDetail.lang || ''
      )
      : '');

  const networkEvidence = sanitizedInput.network_evidence
    || formatNetworkEvidence(sanitizedInput.network || null);

  const suggestions = sanitizeArray(sanitizedInput.suggestions);
  const nextSteps = sanitizeArray(sanitizedInput.next_steps || sanitizedInput.nextSteps);

  return {
    ticket_id: ticketId,
    timestamp,
    service_name: sanitizedInput.service_name || 'serviço não informado',
    namespace: sanitizedInput.namespace || 'namespace não informado',
    summary: sanitizeText(sanitizedInput.summary)
      || 'Resumo não fornecido; revisar evidências coletadas.',
    classification: normalizeClassification(sanitizedInput.classification),
    severity: normalizeSeverity(sanitizedInput.severity),
    confidence: normalizeConfidence(sanitizedInput.confidence),
    error_message: sanitizeText(sanitizedInput.error_message || 'Erro não informado'),
    stack_trace: sanitizeText(sanitizedInput.stack_trace || ''),
    kubernetes_evidence: sanitizeText(kubernetesEvidence),
    code_evidence: sanitizeText(codeEvidence),
    network_evidence: sanitizeText(networkEvidence),
    root_cause: sanitizeText(sanitizedInput.root_cause)
      || 'Causa raiz não identificada automaticamente.',
    suggestions: suggestions.length
      ? suggestions
      : ['Revisar logs completos e métricas do serviço', 'Validar configurações e limites de recursos'],
    next_steps: nextSteps.length
      ? nextSteps
      : ['Confirmar correção em ambiente de homologação', 'Monitorar o serviço após o ajuste'],
    feedback_url: sanitizedInput.feedback_url
      || sanitizedInput.feedbackUrl
      || sanitizedInput.feedback
      || `https://feedback.local/diagnosis/${ticketId}`,
  };
}

function renderReport(input) {
  const data = buildReportData(input);
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const compiled = Handlebars.compile(template, { noEscape: true });
  return {
    report: compiled(data),
    reportData: data,
  };
}

module.exports = {
  renderReport,
  buildReportData,
  sanitizeText,
  formatKubernetesEvidence,
  formatCodeEvidence,
  formatNetworkEvidence,
};
