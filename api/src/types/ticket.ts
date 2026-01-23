export interface Ticket {
  id: string;
  created_at: string;
  updated_at: string;
  service_name: string;
  namespace: string;
  pod_name: string;
  error_message: string;
  stack_trace: string | null;
  alert_timestamp: string | null;
  alert_payload: object;
  classification: "infrastructure" | "code" | "unknown";
  diagnosis_report: string;
  root_cause: string | null;
  suggestions: string[];
  analysis_partial: boolean;
  llm_model: string | null;
  tokens_used: number | null;
  processing_time_ms: number | null;
  feedback_useful: boolean | null;
  feedback_applied: boolean | null;
  feedback_comment: string | null;
  feedback_at: string | null;
}

export interface TicketResponse {
  id: string;
  created_at: string;
  service_name: string;
  namespace: string;
  classification: "infrastructure" | "code" | "unknown";
  diagnosis_report: string;
  root_cause: string | null;
  suggestions: string[];
  alert_payload: object;
}

export interface FeedbackRequest {
  useful: boolean;
  applied: boolean;
  comment?: string;
}
