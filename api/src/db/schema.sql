-- Schema do PostgreSQL para Auto-Troubleshooting Inteligente
-- Versão: 1.0
-- Data: 2026-01-21

-- Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela principal de tickets de diagnóstico
CREATE TABLE diagnosis_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados do alerta original
  service_name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  pod_name VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  alert_timestamp TIMESTAMP WITH TIME ZONE,
  alert_payload JSONB NOT NULL,
  
  -- Resultado da análise
  classification VARCHAR(50) NOT NULL, -- 'infrastructure', 'code', 'unknown'
  diagnosis_report TEXT NOT NULL,       -- Markdown completo
  root_cause TEXT,
  suggestions JSONB,                    -- Array de sugestões
  analysis_partial BOOLEAN DEFAULT FALSE,
  
  -- Metadados
  llm_model VARCHAR(100),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Feedback do usuário
  feedback_useful BOOLEAN,
  feedback_applied BOOLEAN,
  feedback_comment TEXT,
  feedback_at TIMESTAMP WITH TIME ZONE
);

-- Índices para consultas frequentes
CREATE INDEX idx_tickets_service ON diagnosis_tickets(service_name);
CREATE INDEX idx_tickets_created ON diagnosis_tickets(created_at);
CREATE INDEX idx_tickets_classification ON diagnosis_tickets(classification);

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_diagnosis_tickets_updated_at
  BEFORE UPDATE ON diagnosis_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Constraint para validar classificação
ALTER TABLE diagnosis_tickets 
ADD CONSTRAINT chk_classification 
CHECK (classification IN ('infrastructure', 'code', 'unknown'));
