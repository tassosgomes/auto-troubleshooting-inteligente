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
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Erro ao iniciar MCP Server:", error);
  process.exit(1);
});
