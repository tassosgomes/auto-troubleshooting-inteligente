const fs = require('fs');
const path = require('path');
const { renderReport } = require('./report-generator');

const fixturesPath = path.resolve(__dirname, '../../test/fixtures');
const outputPath = path.resolve(__dirname, '../../test/output');

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

const scenarios = [
  {
    name: 'oomkilled',
    file: 'cenario_oomkilled.json',
    extra: {
      classification: 'infrastructure',
      severity: 'high',
      confidence: 'alta',
      summary: 'O pod foi encerrado por falta de memória e reiniciado pelo kubelet.',
      root_cause: 'Limite de memória insuficiente para a carga atual do serviço.',
      kubernetes: {
        podDescription: {
          name: 'payment-service-abc123',
          status: 'CrashLoopBackOff',
          containerStatuses: [
            {
              name: 'payment-service',
              ready: false,
              restartCount: 3,
              state: { terminated: { reason: 'OOMKilled' } },
            },
          ],
        },
        events: [
          { type: 'Warning', reason: 'OOMKilled', message: 'Container excedeu o limite de memória.' },
        ],
      },
      suggestions: [
        'Ajustar o limite de memória do deployment',
        'Revisar o uso de memória no processamento de pagamentos',
      ],
      next_steps: [
        'Aplicar o ajuste em homologação',
        'Monitorar reinícios e métricas de memória',
      ],
    },
  },
  {
    name: 'npe',
    file: 'cenario_npe.json',
    extra: {
      classification: 'code',
      severity: 'medium',
      confidence: 'média',
      summary: 'A aplicação lançou NullPointerException ao processar pedidos.',
      root_cause: 'Objeto de pedido não inicializado antes do acesso.',
      code: {
        filePath: 'src/main/java/com/example/OrderService.java',
        lineNumber: 42,
        codeSnippet: 'Order order = repository.findById(id);\nreturn order.getItems().size();',
        language: 'java',
      },
      suggestions: [
        'Adicionar validação de null antes de acessar order',
        'Criar testes unitários para casos sem pedido',
      ],
      next_steps: [
        'Aplicar correção e executar testes locais',
        'Subir hotfix para produção após validação',
      ],
    },
  },
  {
    name: 'timeout',
    file: 'cenario_timeout.json',
    extra: {
      classification: 'unknown',
      severity: 'medium',
      confidence: 'baixa',
      summary: 'Foi detectado timeout ao consultar API externa de estoque.',
      root_cause: 'Indícios de instabilidade na API externa ou rede.',
      network: {
        url: 'https://api.external.com/v1/stock',
        status_code: 504,
        response_time_ms: 30000,
        error: 'Gateway Timeout',
      },
      suggestions: [
        'Confirmar disponibilidade da API externa',
        'Adicionar retry com backoff exponencial',
      ],
      next_steps: [
        'Abrir incidente com o provedor da API',
        'Monitorar latência e taxa de erro',
      ],
    },
  },
];

scenarios.forEach((scenario) => {
  const fixturePath = path.join(fixturesPath, scenario.file);
  const baseData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const { report, reportData } = renderReport({
    ...baseData,
    ...scenario.extra,
    feedback_url: `https://feedback.local/diagnosis/${scenario.name}-${Date.now()}`,
  });

  const outputFile = path.join(outputPath, `diagnostic_report_${scenario.name}.md`);
  fs.writeFileSync(outputFile, report, 'utf8');

  console.log(`Relatório gerado: ${outputFile} (ticket: ${reportData.ticket_id})`);
});
