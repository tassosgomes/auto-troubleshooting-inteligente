# PRD: Auto-Troubleshooting Inteligente

## Visão Geral

O **Auto-Troubleshooting Inteligente** é um sistema autônomo de diagnóstico de incidentes que atua como suporte de primeiro e segundo nível (L1/L2). O sistema recebe alertas de erro do Elastic Stack, analisa o ambiente Kubernetes e o código-fonte utilizando Agentes de IA com o protocolo MCP (Model Context Protocol), e entrega um diagnóstico detalhado por e-mail.

Atualmente, quando ocorre um erro em produção, o processo de diagnóstico é manual e demorado — podendo levar **horas**. Desenvolvedores precisam acessar logs, identificar pods, inspecionar o cluster Kubernetes, correlacionar stack traces com código e formular hipóteses. A empresa não dispõe de equipe DevOps dedicada, sobrecarregando os desenvolvedores.

O sistema classifica automaticamente cada incidente em três categorias:
1. **Falha de Infraestrutura (Kubernetes)**: Erros de configuração, limites de recursos, falhas de probes
2. **Erro de Codificação (Aplicação)**: Bugs lógicos, exceções não tratadas, regressões
3. **Erro Não Identificado**: Casos inconclusivos com estratégia de depuração sugerida

## Objetivos

| Objetivo | Métrica | Atual | Meta |
|----------|---------|-------|------|
| Reduzir tempo de diagnóstico | MTTD (Mean Time To Diagnose) | Horas | ≤ 30 min |
| Reduzir escalações desnecessárias | Escalações L2/L3 por semana | 10 | ≤ 2 |
| Aumentar autonomia dos devs | % incidentes resolvidos sem escalação | ~20% | ≥ 80% |
| Garantir rastreabilidade | Tickets de diagnóstico auditáveis | 0% | 100% |

**Indicadores de contexto:**
- Alertas de erro por dia: ~10
- Volume esperado: baixo, foco em qualidade do diagnóstico

## Histórias de Usuário

### Usuário Principal: Desenvolvedor
Desenvolvedor de software (backend/fullstack) sem especialização em DevOps/SRE. Trabalha com C#, Java, Python ou TypeScript/Node.js.

**Histórias:**

1. **Como** desenvolvedor, **quero** receber um diagnóstico automático quando meu serviço falha **para que** eu não perca tempo investigando manualmente.

2. **Como** desenvolvedor, **quero** saber se o problema é de infraestrutura ou código **para que** eu saiba onde focar minha correção.

3. **Como** desenvolvedor, **quero** ver a linha exata do código onde ocorreu o erro **para que** eu possa corrigir rapidamente.

4. **Como** desenvolvedor, **quero** receber sugestões de correção **para que** eu resolva problemas mesmo sem expertise em Kubernetes.

5. **Como** desenvolvedor, **quero** consultar diagnósticos anteriores por Ticket ID **para que** eu tenha histórico das análises.

6. **Como** desenvolvedor, **quero** dar feedback sobre a qualidade do diagnóstico **para que** o sistema melhore com o tempo.

7. **Como** desenvolvedor, **quero** receber o alerta original se o sistema de IA falhar **para que** eu não perca incidentes críticos.

## Funcionalidades Principais

### F-001: Recepção de Alertas via Webhook
Recebe alertas de erro do Elastic Stack via webhook HTTP.

**Requisitos funcionais:**
1. Aceitar payload JSON com: `service_name`, `error_message`, `stack_trace`, `pod_name`, `namespace`
2. Processar payload em < 5 segundos
3. Validar campos obrigatórios e retornar erro 400 se inválido

### F-002: Triagem Automática de Incidentes
A IA classifica o erro em: Infraestrutura, Código ou Desconhecido.

**Requisitos funcionais:**
1. Analisar stack trace e mensagem de erro
2. Classificar com precisão ≥ 80% dos casos
3. Registrar classificação para auditoria

### F-003: Análise de Kubernetes
Para erros de infraestrutura, inspeciona o cluster via MCP.

**Requisitos funcionais:**
1. Executar `kubectl describe pod` para eventos recentes
2. Analisar ConfigMaps e Secrets (presença de chaves, sem expor valores)
3. Verificar OOMKilled, CrashLoopBackOff, probe failures
4. Identificar causa raiz em cenários comuns de K8s

### F-004: Análise de Código-Fonte
Para erros de código, clona e analisa o repositório.

**Requisitos funcionais:**
1. Obter URL do repositório via annotations K8s (`project.info/repo-url`, `project.info/branch`)
2. Clonar com `git clone --depth 1` via SSH
3. Correlacionar stack trace com linhas de código
4. Suportar: C#, Java, Python, TypeScript/Node.js
5. Localizar arquivo e linha correta em ≥ 90% dos casos com stack trace válido

### F-005: Teste de Conectividade
Valida acesso a APIs externas mencionadas no erro.

**Requisitos funcionais:**
1. Executar requisições HTTP/HTTPS via curl
2. Reportar status code, tempo de resposta ou erro de conexão

### F-006: Geração de Relatório de Diagnóstico
Produz relatório técnico completo em Markdown.

**Requisitos funcionais:**
1. Incluir: resumo executivo, classificação, evidências, causa raiz, sugestões de correção
2. Formato autoexplicativo que permite ação sem intervenção adicional
3. NUNCA expor valores de Secrets (apenas nomes de chaves)

### F-007: Envio de E-mail com Diagnóstico
Entrega o relatório via SMTP.

**Requisitos funcionais:**
1. Enviar para desenvolvedor responsável (configurável)
2. Incluir Ticket ID e link para consulta completa
3. Entregar em < 2 minutos após conclusão da análise

### F-008: Armazenamento e Consulta de Diagnósticos
Persiste cada diagnóstico com Ticket ID único.

**Requisitos funcionais:**
1. Armazenar: Ticket ID, timestamp, classificação, relatório, alerta original
2. Permitir consulta por Ticket ID
3. Manter histórico para auditoria

### F-009: Feedback do Usuário
Permite avaliação da qualidade do diagnóstico.

**Requisitos funcionais:**
1. Aceitar feedback: útil/não útil, correção aplicada
2. Associar feedback ao Ticket ID

### F-010: Fallback para LLM Indisponível
Garante entrega mesmo com falha da IA.

**Requisitos funcionais:**
1. Detectar timeout ou erro do LLM
2. Enviar alerta original por e-mail em < 1 minuto
3. Indicar claramente que análise automática falhou

## Experiência do Usuário

### Fluxo Principal
1. Erro ocorre em produção → Elastic dispara alerta
2. Sistema recebe webhook → Triagem automática
3. IA analisa K8s e/ou código → Gera relatório
4. Desenvolvedor recebe e-mail com diagnóstico e Ticket ID
5. Desenvolvedor consulta relatório completo (se necessário)
6. Desenvolvedor pode usar GitHub Copilot/Claude Code para ajuda adicional
7. Desenvolvedor fornece feedback (opcional)

### Requisitos de UX
- Relatório deve ser bem escrito, claro e acionável
- E-mail deve ter formatação limpa e profissional
- Ticket ID deve ser fácil de copiar e pesquisar
- Interface de consulta deve ser simples (v1: pode ser API/página básica)

### Acessibilidade
- E-mails devem funcionar em clientes de texto puro
- Relatórios em Markdown renderizável

## Restrições Técnicas de Alto Nível

### Segurança
- **RBAC Kubernetes**: Acesso read-only (`get`, `list`, `watch`) em: pods, events, configmaps, secrets, deployments
- **Git**: Chaves SSH com permissão de leitura apenas (Deploy Keys)
- **Secrets**: Prompt do LLM deve proibir explicitamente exibição de valores sensíveis

### Integrações Requeridas
- **Elastic Stack**: Webhook de alertas (já configurado, fora do escopo)
- **Kubernetes**: Cluster único com N namespaces, kubeconfig local
- **Git**: GitHub + Azure DevOps via SSH (metadata em annotations dos deployments)
- **LLM**: Gemini 3.0 ou GPT 5.2 via API
- **E-mail**: SMTP corporativo

### Infraestrutura
- Host: Linux (Ubuntu/Debian)
- Deploy: Docker Compose com n8n + MCP Server
- Disponibilidade: 24/7 com restart automático

### Performance
- Análise de código: ler apenas arquivos relevantes (otimização de tokens)
- Processamento: < 5 segundos para receber alerta, < 2 minutos para diagnóstico completo

## Não-Objetivos (Fora de Escopo)

- ❌ **Ações automáticas** (restart de pod, rollback, scaling) — apenas sugestões
- ❌ **Configuração do Elastic Stack** — já provisionado
- ❌ **Análise de banco de dados** — queries lentas, locks, conexões
- ❌ **Análise de rede externa** — firewalls, DNS, VPN
- ❌ **Integração com Teams/Slack** — futuro (v2)
- ❌ **Workloads fora do Kubernetes** — VMs, serverless
- ❌ **Métricas de APM** — traces distribuídos, profiling

## Questões em Aberto

~~Todas as questões foram resolvidas — ver seção "Decisões Técnicas" abaixo.~~

---

## Decisões Técnicas (Resolvidas)

| Questão | Decisão |
|---------|---------|
| Estrutura das annotations K8s | `project.info/metadata` (repo-url, branch, owner-email) |
| Banco de dados | PostgreSQL |
| Formato do Ticket ID | UUID |
| Template do e-mail | Markdown |
| Estratégia de retry/fallback | Se falhar, envia análise parcial + alerta original |
| E-mail do desenvolvedor | Via annotation `project.info/metadata` no deployment |

---

## Anexo: Critérios de Aceitação do MVP

- [ ] **Cenário 1 - OOMKilled**: Pod encerrado por falta de memória → Classifica como Infra, identifica OOMKilled, sugere aumento de limits
- [ ] **Cenário 2 - NullPointerException (Java)**: Aplicação lança NPE → Classifica como Código, localiza linha exata, sugere verificação de null
- [ ] **Cenário 3 - Timeout de Integração**: Falha ao chamar API externa → Classifica como Desconhecido, executa curl, reporta status da API
- [ ] E-mail enviado com Ticket ID em todos os cenários
- [ ] Diagnóstico consultável pelo Ticket ID
- [ ] Fallback funcional quando LLM indisponível

---

## Anexo: Arquitetura de Alto Nível

```
┌─────────────────┐     Webhook      ┌─────────────────┐
│  Elastic Stack  │ ───────────────► │      n8n        │
│    (Alertas)    │                  │  (Orquestrador) │
└─────────────────┘                  └────────┬────────┘
                                              │
                           ┌──────────────────┼──────────────────┐
                           │                  │                  │
                           ▼                  ▼                  ▼
                    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                    │  MCP Server │    │  LLM API    │    │    SMTP     │
                    │ (Kubernetes)│    │(Gemini/GPT) │    │   (Email)   │
                    └──────┬──────┘    └─────────────┘    └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ kubectl  │ │ git clone│ │   curl   │
        │ describe │ │ (SSH)    │ │ (HTTP)   │
        └──────────┘ └──────────┘ └──────────┘
```

---

*Versão 1.0 | 2026-01-21 | Autor: Tasso Gomes*
