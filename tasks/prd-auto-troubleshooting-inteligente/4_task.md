## status: done

<task_context>
<domain>mcp-server/git</domain>
<type>implementation</type>
<scope>core_feature</scope>
<complexity>high</complexity>
<dependencies>simple-git, mcp-sdk</dependencies>
</task_context>

# Tarefa 4.0: Desenvolver MCP Server - Tools Git

## Visão Geral

Implementar tools no MCP Server para clonagem e leitura de repositórios Git via SSH. As tools permitem clonar repositórios (shallow clone), ler arquivos específicos e fazer cleanup após análise.

<requirements>
- Tools para Git: cloneRepo, readFile, listFiles, cleanupRepo
- Suporte a GitHub e Azure DevOps via SSH
- Clone shallow (--depth 1) para otimização
- Cleanup automático após análise
- Chaves SSH configuráveis
</requirements>

## Subtarefas

- [x] 4.1 Instalar dependência simple-git
- [x] 4.2 Implementar tool `cloneRepo` com shallow clone
- [x] 4.3 Implementar tool `readFile` para ler arquivo específico
- [x] 4.4 Implementar tool `listFiles` para listar diretório
- [x] 4.5 Implementar tool `cleanupRepo` para remover clone
- [x] 4.6 Configurar SSH agent para múltiplas chaves (GitHub + Azure DevOps)
- [x] 4.7 Implementar timeout para operações de clone
- [x] 4.8 Adicionar tratamento de erro para repositório inacessível
- [x] 4.9 Testar com repositórios de exemplo

## Detalhes de Implementação

### Interface das Tools

```typescript
interface GitMCPTools {
  cloneRepo(repoUrl: string, branch: string): Promise<string>;
  readFile(repoPath: string, filePath: string): Promise<string>;
  listFiles(repoPath: string, directory: string): Promise<string[]>;
  cleanupRepo(repoPath: string): Promise<void>;
}
```

### Estrutura

```
mcp-server/
├── src/
│   ├── tools/
│   │   ├── kubernetes.ts
│   │   └── git.ts          # Nova
│   └── config/
│       └── ssh.ts          # Configuração SSH
```

### Implementação - cloneRepo

```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const CLONE_TIMEOUT_MS = 30000;

export async function cloneRepo(repoUrl: string, branch: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'troubleshooting-'));
  
  const git: SimpleGit = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS }
  });

  await git.clone(repoUrl, tempDir, [
    '--depth', '1',
    '--branch', branch,
    '--single-branch'
  ]);

  return tempDir;
}
```

### Implementação - readFile

```typescript
import { readFile as fsReadFile } from 'fs/promises';
import { join } from 'path';

export async function readFile(repoPath: string, filePath: string): Promise<string> {
  const fullPath = join(repoPath, filePath);
  
  // Validação de segurança: impedir path traversal
  if (!fullPath.startsWith(repoPath)) {
    throw new Error('Path traversal detectado');
  }

  const content = await fsReadFile(fullPath, 'utf-8');
  return content;
}
```

### Implementação - listFiles

```typescript
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export async function listFiles(repoPath: string, directory: string): Promise<string[]> {
  const fullPath = join(repoPath, directory);
  
  if (!fullPath.startsWith(repoPath)) {
    throw new Error('Path traversal detectado');
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  return entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
}
```

### Implementação - cleanupRepo

```typescript
import { rm } from 'fs/promises';

export async function cleanupRepo(repoPath: string): Promise<void> {
  // Validação: só remove diretórios temporários
  if (!repoPath.includes('troubleshooting-')) {
    throw new Error('Cleanup apenas permitido para diretórios temporários');
  }

  await rm(repoPath, { recursive: true, force: true });
}
```

### Configuração SSH

```typescript
// src/config/ssh.ts
import { execSync } from 'child_process';

export function setupSSHAgent() {
  // Adiciona chaves SSH ao agent
  const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '/home/app/.ssh/id_rsa';
  
  try {
    execSync(`ssh-add ${sshKeyPath}`, { stdio: 'ignore' });
  } catch (error) {
    console.warn('SSH key não adicionada ao agent:', error);
  }
}

export function getSSHConfig(): string {
  return `
Host github.com
  IdentityFile ~/.ssh/github_deploy_key
  StrictHostKeyChecking no

Host ssh.dev.azure.com
  IdentityFile ~/.ssh/azure_deploy_key
  StrictHostKeyChecking no
`;
}
```

### Dockerfile - SSH Setup

```dockerfile
FROM node:20-alpine

# Instalar git e openssh
RUN apk add --no-cache git openssh-client

# Criar diretório SSH
RUN mkdir -p /home/app/.ssh && chmod 700 /home/app/.ssh

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# SSH config para múltiplos hosts
COPY ssh_config /home/app/.ssh/config

USER node
CMD ["node", "dist/index.js"]
```

## Critérios de Sucesso

- [ ] `cloneRepo` clona repositório em < 30 segundos (shallow)
- [ ] `readFile` lê arquivos específicos corretamente
- [ ] `listFiles` lista conteúdo de diretórios
- [ ] `cleanupRepo` remove diretórios temporários
- [ ] Funciona com GitHub (git@github.com:...)
- [ ] Funciona com Azure DevOps (git@ssh.dev.azure.com:...)
- [ ] Path traversal é bloqueado
- [ ] Erro de clone é tratado graciosamente (fallback)

## Referências

- PRD: F-004 (Análise de Código-Fonte)
- Tech Spec: Seção "Interface MCP - Git Tools"
