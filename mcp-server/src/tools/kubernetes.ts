import {
  AppsV1Api,
  CoreV1Event,
  CoreV1Api,
  KubeConfig,
  V1ConfigMap,
  V1Deployment,
  V1Pod,
  V1Secret,
} from "@kubernetes/client-node";
import {
  DeploymentSummary,
  EventSummary,
  PodDescription,
} from "../types/kubernetes.js";

const PROJECT_INFO_ANNOTATION = "project.info/metadata";

function createKubeConfig(): KubeConfig {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();
  return kubeConfig;
}

function getCoreApi(): CoreV1Api {
  const kubeConfig = createKubeConfig();
  return kubeConfig.makeApiClient(CoreV1Api);
}

function getAppsApi(): AppsV1Api {
  const kubeConfig = createKubeConfig();
  return kubeConfig.makeApiClient(AppsV1Api);
}

function mapEvent(event: CoreV1Event): EventSummary {
  return {
    type: event.type ?? undefined,
    reason: event.reason ?? undefined,
    message: event.message ?? undefined,
    lastTimestamp:
      event.lastTimestamp instanceof Date
        ? event.lastTimestamp.toISOString()
        : (event.lastTimestamp as string | undefined),
  };
}

function mapPodDescription(
  pod: V1Pod,
  events: CoreV1Event[]
): PodDescription {
  const startTime = pod.status?.startTime;

  return {
    name: pod.metadata?.name ?? undefined,
    namespace: pod.metadata?.namespace ?? undefined,
    status: pod.status?.phase ?? undefined,
    nodeName: pod.spec?.nodeName ?? undefined,
    startTime:
      startTime instanceof Date ? startTime.toISOString() : startTime ?? undefined,
    conditions: pod.status?.conditions?.map((condition) => ({ ...condition })) ?? [],
    containerStatuses:
      pod.status?.containerStatuses?.map((container) => ({
        name: container.name,
        ready: container.ready,
        restartCount: container.restartCount ?? 0,
        state: container.state ? { ...container.state } : undefined,
      })) ?? [],
    events: events.map(mapEvent),
  };
}

function extractConfigMapKeys(configMap: V1ConfigMap): string[] {
  const dataKeys = Object.keys(configMap.data ?? {});
  const binaryKeys = Object.keys(configMap.binaryData ?? {});
  return Array.from(new Set([...dataKeys, ...binaryKeys])).sort();
}

function extractSecretKeys(secret: V1Secret): string[] {
  const dataKeys = Object.keys(secret.data ?? {});
  const stringDataKeys = Object.keys(secret.stringData ?? {});
  return Array.from(new Set([...dataKeys, ...stringDataKeys])).sort();
}

export async function describePod(
  namespace: string,
  podName: string
): Promise<PodDescription> {
  const coreApi = getCoreApi();
  const podResponse = await coreApi.readNamespacedPod({
    name: podName,
    namespace,
  });
  const eventsResponse = await coreApi.listNamespacedEvent({
    namespace,
    fieldSelector: `involvedObject.name=${podName}`,
  });

  return mapPodDescription(podResponse, eventsResponse.items ?? []);
}

export async function getEvents(
  namespace: string,
  podName?: string
): Promise<EventSummary[]> {
  const coreApi = getCoreApi();
  const fieldSelector = podName ? `involvedObject.name=${podName}` : undefined;
  const eventsResponse = await coreApi.listNamespacedEvent({
    namespace,
    fieldSelector,
  });

  return (eventsResponse.items ?? []).map(mapEvent);
}

export async function getDeployment(
  namespace: string,
  deploymentName: string
): Promise<DeploymentSummary> {
  const appsApi = getAppsApi();
  const deploymentResponse = await appsApi.readNamespacedDeployment({
    name: deploymentName,
    namespace,
  });

  const deployment: V1Deployment = deploymentResponse;
  const annotations = deployment.metadata?.annotations ?? {};

  return {
    name: deployment.metadata?.name ?? undefined,
    namespace: deployment.metadata?.namespace ?? undefined,
    annotations,
    projectInfoMetadata: annotations[PROJECT_INFO_ANNOTATION],
    replicas: deployment.status?.replicas ?? undefined,
    availableReplicas: deployment.status?.availableReplicas ?? undefined,
    updatedReplicas: deployment.status?.updatedReplicas ?? undefined,
  };
}

export async function getConfigMapKeys(
  namespace: string,
  configMapName: string
): Promise<string[]> {
  const coreApi = getCoreApi();
  const configMapResponse = await coreApi.readNamespacedConfigMap({
    name: configMapName,
    namespace,
  });

  return extractConfigMapKeys(configMapResponse);
}

export async function getSecretKeys(
  namespace: string,
  secretName: string
): Promise<string[]> {
  const coreApi = getCoreApi();
  const secretResponse = await coreApi.readNamespacedSecret({
    name: secretName,
    namespace,
  });

  return extractSecretKeys(secretResponse);
}
