import { beforeEach, describe, expect, it, vi } from "vitest";

const coreClient = {
  readNamespacedPod: vi.fn(),
  listNamespacedEvent: vi.fn(),
  readNamespacedConfigMap: vi.fn(),
  readNamespacedSecret: vi.fn(),
};

const appsClient = {
  readNamespacedDeployment: vi.fn(),
};

vi.mock("@kubernetes/client-node", () => {
  class CoreV1Api {}
  class AppsV1Api {}
  class KubeConfig {
    loadFromDefault = vi.fn();
    makeApiClient(api: unknown) {
      if (api === CoreV1Api) {
        return coreClient;
      }
      if (api === AppsV1Api) {
        return appsClient;
      }
      throw new Error("Unknown API client");
    }
  }

  class V1Pod {}
  class CoreV1Event {}
  class V1ConfigMap {}
  class V1Secret {}
  class V1Deployment {}

  return {
    AppsV1Api,
    CoreV1Event,
    CoreV1Api,
    KubeConfig,
    V1ConfigMap,
    V1Deployment,
    V1Pod,
    V1Secret,
  };
});

import {
  describePod,
  getConfigMapKeys,
  getDeployment,
  getEvents,
  getSecretKeys,
} from "../src/tools/kubernetes.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("kubernetes tools", () => {
  it("retorna apenas chaves de Secrets", async () => {
    coreClient.readNamespacedSecret.mockResolvedValue({
      data: { username: "YWRtaW4=", password: "c2VjcmV0" },
      stringData: { token: "abc" },
    });

    const result = await getSecretKeys("default", "db-credentials");

    expect(result).toEqual(["password", "token", "username"]);
  });

  it("retorna chaves de ConfigMaps", async () => {
    coreClient.readNamespacedConfigMap.mockResolvedValue({
      data: { host: "db" },
      binaryData: { cert: "Y2VydA==" },
    });

    const result = await getConfigMapKeys("default", "app-config");

    expect(result).toEqual(["cert", "host"]);
  });

  it("descreve pod com eventos", async () => {
    coreClient.readNamespacedPod.mockResolvedValue({
      metadata: { name: "app-pod", namespace: "default" },
      spec: { nodeName: "node-1" },
      status: {
        phase: "Running",
        startTime: "2026-01-22T10:00:00Z",
        conditions: [{ type: "Ready", status: "True" }],
        containerStatuses: [
          {
            name: "app",
            ready: true,
            restartCount: 1,
            state: { running: { startedAt: "2026-01-22T10:01:00Z" } },
          },
        ],
      },
    });

    coreClient.listNamespacedEvent.mockResolvedValue({
      items: [
        {
          type: "Warning",
          reason: "BackOff",
          message: "CrashLoopBackOff",
          lastTimestamp: "2026-01-22T10:05:00Z",
        },
      ],
    });

    const result = await describePod("default", "app-pod");

    expect(result.name).toBe("app-pod");
    expect(result.events).toHaveLength(1);
    expect(result.containerStatuses?.[0].name).toBe("app");
  });

  it("lista eventos filtrando por pod", async () => {
    coreClient.listNamespacedEvent.mockResolvedValue({
      items: [
        {
          type: "Normal",
          reason: "Pulled",
          message: "Image pulled",
          lastTimestamp: "2026-01-22T10:02:00Z",
        },
      ],
    });

    const result = await getEvents("default", "app-pod");

    expect(result[0].reason).toBe("Pulled");
  });

  it("retorna deployment com annotations", async () => {
    appsClient.readNamespacedDeployment.mockResolvedValue({
      metadata: {
        name: "app",
        namespace: "default",
        annotations: {
          "project.info/metadata": "{\"repo_url\":\"git@github.com:org/app.git\"}",
        },
      },
      status: {
        replicas: 2,
        availableReplicas: 2,
        updatedReplicas: 2,
      },
    });

    const result = await getDeployment("default", "app");

    expect(result.projectInfoMetadata).toContain("repo_url");
  });
});
