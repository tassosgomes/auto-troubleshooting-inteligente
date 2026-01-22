export interface EventSummary {
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string;
}

export interface ContainerStatusSummary {
  name: string;
  ready: boolean;
  restartCount: number;
  state?: Record<string, unknown>;
}

export interface PodDescription {
  name?: string;
  namespace?: string;
  status?: string;
  nodeName?: string;
  startTime?: string;
  conditions?: Array<Record<string, unknown>>;
  containerStatuses?: ContainerStatusSummary[];
  events: EventSummary[];
}

export interface DeploymentSummary {
  name?: string;
  namespace?: string;
  annotations?: Record<string, string>;
  projectInfoMetadata?: string;
  replicas?: number;
  availableReplicas?: number;
  updatedReplicas?: number;
}
