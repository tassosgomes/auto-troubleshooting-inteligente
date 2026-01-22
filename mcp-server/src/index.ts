import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  describePod,
  getConfigMapKeys,
  getDeployment,
  getEvents,
  getSecretKeys,
} from "./tools/kubernetes.js";
import { setupSSHAgent } from "./config/ssh.js";
import {
  cleanupRepo,
  cloneRepo,
  listFiles,
  readFile,
} from "./tools/git.js";
import { httpRequest } from "./tools/network.js";

const server = new Server(
  {
    name: "mcp-kubernetes-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  {
    name: "describePod",
    description: "Descreve um pod e retorna eventos recentes.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        podName: { type: "string" },
      },
      required: ["namespace", "podName"],
    },
  },
  {
    name: "getEvents",
    description: "Lista eventos do namespace, opcionalmente filtrando por pod.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        podName: { type: "string" },
      },
      required: ["namespace"],
    },
  },
  {
    name: "getDeployment",
    description:
      "Obtém deployment e suas annotations, incluindo project.info/metadata.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        deploymentName: { type: "string" },
      },
      required: ["namespace", "deploymentName"],
    },
  },
  {
    name: "getConfigMapKeys",
    description: "Lista as chaves de um ConfigMap (sem valores).",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        configMapName: { type: "string" },
      },
      required: ["namespace", "configMapName"],
    },
  },
  {
    name: "getSecretKeys",
    description: "Lista as chaves de um Secret (NUNCA valores).",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        secretName: { type: "string" },
      },
      required: ["namespace", "secretName"],
    },
  },
  {
    name: "cloneRepo",
    description: "Clona repositório Git via SSH usando shallow clone.",
    inputSchema: {
      type: "object",
      properties: {
        repoUrl: { type: "string" },
        branch: { type: "string" },
      },
      required: ["repoUrl", "branch"],
    },
  },
  {
    name: "readFile",
    description: "Lê um arquivo específico do repositório clonado.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string" },
        filePath: { type: "string" },
      },
      required: ["repoPath", "filePath"],
    },
  },
  {
    name: "listFiles",
    description: "Lista arquivos em um diretório do repositório clonado.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string" },
        directory: { type: "string" },
      },
      required: ["repoPath", "directory"],
    },
  },
  {
    name: "cleanupRepo",
    description: "Remove o diretório temporário clonado.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string" },
      },
      required: ["repoPath"],
    },
  },
  {
    name: "httpRequest",
    description: "Executa requisição HTTP/HTTPS para testar conectividade.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL completa (http:// ou https://)" },
        method: {
          type: "string",
          enum: ["GET", "POST", "HEAD"],
          default: "GET",
        },
        timeout: { type: "number", description: "Timeout em ms", default: 10000 },
      },
      required: ["url"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = request.params.arguments ?? {};

  switch (name) {
    case "describePod": {
      const { namespace, podName } = args as {
        namespace: string;
        podName: string;
      };
      const result = await describePod(namespace, podName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "getEvents": {
      const { namespace, podName } = args as {
        namespace: string;
        podName?: string;
      };
      const result = await getEvents(namespace, podName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "getDeployment": {
      const { namespace, deploymentName } = args as {
        namespace: string;
        deploymentName: string;
      };
      const result = await getDeployment(namespace, deploymentName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "getConfigMapKeys": {
      const { namespace, configMapName } = args as {
        namespace: string;
        configMapName: string;
      };
      const result = await getConfigMapKeys(namespace, configMapName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "getSecretKeys": {
      const { namespace, secretName } = args as {
        namespace: string;
        secretName: string;
      };
      const result = await getSecretKeys(namespace, secretName);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "cloneRepo": {
      const { repoUrl, branch } = args as {
        repoUrl: string;
        branch: string;
      };
      const result = await cloneRepo(repoUrl, branch);
      return {
        content: [{ type: "text", text: result }],
      };
    }
    case "readFile": {
      const { repoPath, filePath } = args as {
        repoPath: string;
        filePath: string;
      };
      const result = await readFile(repoPath, filePath);
      return {
        content: [{ type: "text", text: result }],
      };
    }
    case "listFiles": {
      const { repoPath, directory } = args as {
        repoPath: string;
        directory: string;
      };
      const result = await listFiles(repoPath, directory);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    case "cleanupRepo": {
      const { repoPath } = args as {
        repoPath: string;
      };
      await cleanupRepo(repoPath);
      return {
        content: [{ type: "text", text: "Cleanup concluído" }],
      };
    }
    case "httpRequest": {
      const { url, method, timeout } = args as {
        url: string;
        method?: string;
        timeout?: number;
      };
      const result = await httpRequest(url, method, timeout);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
});

async function main() {
  setupSSHAgent();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Erro ao iniciar MCP Server:", error);
  process.exit(1);
});
