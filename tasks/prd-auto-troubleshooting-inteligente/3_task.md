## status: pending

<task_context>
<domain>mcp-server/kubernetes</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>kubernetes-client, mcp-sdk</dependencies>
</task_context>

# Tarefa 3.0: Desenvolver MCP Server - Tools Kubernetes

## Visão Geral

Implementar o MCP Server com ferramentas (tools) para interação read-only com o cluster Kubernetes. As tools permitem descrever pods, listar eventos, obter deployments com annotations, e verificar ConfigMaps/Secrets (apenas nomes de chaves).

<requirements>
- MCP Server funcional com protocolo MCP
- Tools para K8s: describePod, getEvents, getDeployment, getConfigMapKeys, getSecretKeys
- Acesso via kubeconfig local
- Permissões RBAC read-only
- NUNCA expor valores de Secrets
</requirements>

## Subtarefas

- [ ] 3.1 Criar projeto Node.js/TypeScript para MCP Server
- [ ] 3.2 Configurar MCP SDK (@modelcontextprotocol/sdk)
- [ ] 3.3 Configurar cliente Kubernetes (@kubernetes/client-node)
- [ ] 3.4 Implementar tool `describePod`
- [ ] 3.5 Implementar tool `getEvents`
- [ ] 3.6 Implementar tool `getDeployment`
- [ ] 3.7 Implementar tool `getConfigMapKeys`
- [ ] 3.8 Implementar tool `getSecretKeys` (apenas nomes, NUNCA valores)
- [ ] 3.9 Criar Dockerfile para o MCP Server
- [ ] 3.10 Adicionar ao docker-compose.yml
- [ ] 3.11 Criar manifesto RBAC (ClusterRole read-only)
- [ ] 3.12 Testar tools com cluster de desenvolvimento

## Detalhes de Implementação

### Interface das Tools

```typescript
interface KubernetesMCPTools {
  describePod(namespace: string, podName: string): Promise<PodDescription>;
  getEvents(namespace: string, podName?: string): Promise<Event[]>;
  getDeployment(namespace: string, deploymentName: string): Promise<Deployment>;
  getConfigMapKeys(namespace: string, configMapName: string): Promise<string[]>;
  getSecretKeys(namespace: string, secretName: string): Promise<string[]>;
}
```

### Estrutura do Projeto

```
mcp-server/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point MCP Server
│   ├── tools/
│   │   └── kubernetes.ts  # Tools K8s
│   └── types/
│       └── kubernetes.ts  # Tipos TypeScript
└── test/
    └── kubernetes.test.ts
```

### Exemplo de Tool - describePod

```typescript
import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';

export async function describePod(namespace: string, podName: string) {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(CoreV1Api);

  const pod = await k8sApi.readNamespacedPod(podName, namespace);
  const events = await k8sApi.listNamespacedEvent(namespace, undefined, undefined, undefined, `involvedObject.name=${podName}`);

  return {
    name: pod.body.metadata?.name,
    namespace: pod.body.metadata?.namespace,
    status: pod.body.status?.phase,
    conditions: pod.body.status?.conditions,
    containerStatuses: pod.body.status?.containerStatuses?.map(c => ({
      name: c.name,
      ready: c.ready,
      restartCount: c.restartCount,
      state: c.state
    })),
    events: events.body.items.map(e => ({
      type: e.type,
      reason: e.reason,
      message: e.message,
      lastTimestamp: e.lastTimestamp
    }))
  };
}
```

### RBAC Kubernetes

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: troubleshooting-reader
rules:
- apiGroups: [""]
  resources: ["pods", "events", "configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: troubleshooting-reader-binding
subjects:
- kind: ServiceAccount
  name: troubleshooting-sa
  namespace: troubleshooting
roleRef:
  kind: ClusterRole
  name: troubleshooting-reader
  apiGroup: rbac.authorization.k8s.io
```

### Segurança - getSecretKeys

```typescript
// CRÍTICO: Retorna APENAS nomes das chaves, NUNCA valores
export async function getSecretKeys(namespace: string, secretName: string): Promise<string[]> {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(CoreV1Api);

  const secret = await k8sApi.readNamespacedSecret(secretName, namespace);
  
  // Retorna APENAS os nomes das chaves
  return Object.keys(secret.body.data || {});
}
```

## Critérios de Sucesso

- [ ] MCP Server inicia e registra tools corretamente
- [ ] `describePod` retorna informações do pod e eventos recentes
- [ ] `getEvents` filtra eventos por namespace/pod
- [ ] `getDeployment` retorna deployment com annotations `project.info/metadata`
- [ ] `getConfigMapKeys` retorna lista de chaves (sem valores)
- [ ] `getSecretKeys` retorna lista de chaves (NUNCA valores)
- [ ] Container Docker funciona com kubeconfig montado
- [ ] Testes unitários passam com mocks do K8s client

## Referências

- PRD: F-003 (Análise de Kubernetes)
- Tech Spec: Seção "Interface MCP - Kubernetes Tools" e "RBAC Kubernetes"
