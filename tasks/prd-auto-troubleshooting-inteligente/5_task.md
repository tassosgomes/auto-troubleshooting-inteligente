## status: pending

<task_context>
<domain>mcp-server/network</domain>
<type>implementation</type>
<scope>middleware</scope>
<complexity>low</complexity>
<dependencies>node-fetch, mcp-sdk</dependencies>
</task_context>

# Tarefa 5.0: Desenvolver MCP Server - Tools Network

## Visão Geral

Implementar tool no MCP Server para teste de conectividade HTTP/HTTPS. Permite validar acesso a APIs externas mencionadas em erros de timeout ou conexão.

<requirements>
- Tool `httpRequest` para teste de conectividade
- Suporte a métodos GET, POST, HEAD
- Timeout configurável
- Retorno de status code, tempo de resposta e erro
</requirements>

## Subtarefas

- [ ] 5.1 Implementar tool `httpRequest`
- [ ] 5.2 Configurar timeout padrão (10 segundos)
- [ ] 5.3 Capturar e retornar tempo de resposta
- [ ] 5.4 Tratar erros de conexão (timeout, DNS, refused)
- [ ] 5.5 Testar com URLs de exemplo

## Detalhes de Implementação

### Interface da Tool

```typescript
interface NetworkMCPTools {
  httpRequest(url: string, method?: string, timeout?: number): Promise<HttpResult>;
}

interface HttpResult {
  status_code: number | null;
  response_time_ms: number;
  error?: string;
  headers?: Record<string, string>;
}
```

### Implementação

```typescript
// src/tools/network.ts

const DEFAULT_TIMEOUT_MS = 10000;

export async function httpRequest(
  url: string,
  method: string = 'GET',
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<HttpResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Auto-Troubleshooting/1.0'
      }
    });

    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

    return {
      status_code: response.status,
      response_time_ms: responseTime,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    clearTimeout(timeoutId);

    let errorMessage = 'Unknown error';
    
    if (error.name === 'AbortError') {
      errorMessage = `Timeout após ${timeout}ms`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `DNS não resolvido: ${new URL(url).hostname}`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `Conexão recusada: ${url}`;
    } else if (error.code === 'ECONNRESET') {
      errorMessage = 'Conexão resetada pelo servidor';
    } else {
      errorMessage = error.message || String(error);
    }

    return {
      status_code: null,
      response_time_ms: responseTime,
      error: errorMessage
    };
  }
}
```

### Registro no MCP Server

```typescript
// src/index.ts (adicionar)
import { httpRequest } from './tools/network';

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'httpRequest':
      return await httpRequest(args.url, args.method, args.timeout);
    // ... outras tools
  }
});

// Definição da tool
const networkTools = [
  {
    name: 'httpRequest',
    description: 'Executa requisição HTTP/HTTPS para testar conectividade com API externa',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL completa (http:// ou https://)' },
        method: { type: 'string', enum: ['GET', 'POST', 'HEAD'], default: 'GET' },
        timeout: { type: 'number', description: 'Timeout em ms', default: 10000 }
      },
      required: ['url']
    }
  }
];
```

## Critérios de Sucesso

- [ ] `httpRequest` retorna status code para URLs válidas
- [ ] Tempo de resposta é medido corretamente
- [ ] Timeout é respeitado (retorna erro após tempo limite)
- [ ] Erros de DNS são identificados claramente
- [ ] Erros de conexão recusada são identificados
- [ ] Suporta HTTP e HTTPS

## Referências

- PRD: F-005 (Teste de Conectividade)
- Tech Spec: Seção "Interface MCP - Network Tools"
