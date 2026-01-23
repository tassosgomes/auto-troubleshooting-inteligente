import { Response, Router } from "express";
import pool from "../db/connection";
import { FeedbackRequest, TicketResponse } from "../types/ticket";

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function sendProblem(res: Response, status: number, title: string, detail?: string) {
  return res
    .status(status)
    .type("application/problem+json")
    .json({
      type: "about:blank",
      title,
      status,
      detail,
      instance: res.req?.originalUrl,
    });
}

function parseLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parsePage(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

// GET /api/v1/tickets/:id
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return sendProblem(res, 400, "Requisição inválida", "ID inválido");
  }

  try {
    const result = await pool.query<TicketResponse>(
      `SELECT id, created_at, service_name, namespace, classification,
              diagnosis_report, root_cause, suggestions, alert_payload
       FROM diagnosis_tickets WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendProblem(res, 404, "Recurso não encontrado", "Ticket não encontrado");
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar ticket:", error);
    return sendProblem(res, 500, "Erro interno", "Falha ao consultar ticket");
  }
});

// GET /api/v1/tickets?service={name}
router.get("/", async (req, res) => {
  const { service, limit, offset, _page, _size } = req.query;
  const pageProvided = _page !== undefined && _page !== null && _page !== "";

  if (service && typeof service !== "string") {
    return sendProblem(res, 400, "Requisição inválida", "service deve ser string");
  }

  const limitValue = parseLimit(limit ?? _size);
  if (limitValue === null) {
    return sendProblem(res, 400, "Requisição inválida", "limit inválido");
  }

  const pageValue = parsePage(_page);
  if (pageProvided && pageValue === null) {
    return sendProblem(res, 400, "Requisição inválida", "_page inválido");
  }

  const offsetValue =
    offset !== undefined
      ? parseOffset(offset)
      : (pageValue ?? 1) > 0
      ? ((pageValue ?? 1) - 1) * limitValue
      : 0;
  if (offsetValue === null) {
    return sendProblem(res, 400, "Requisição inválida", "offset inválido");
  }

  const computedPage = pageProvided ? (pageValue ?? 1) : Math.floor(offsetValue / limitValue) + 1;

  let query = `
    SELECT id, created_at, service_name, namespace, classification, root_cause
    FROM diagnosis_tickets
  `;
  const params: Array<string | number> = [];

  if (service) {
    query += ` WHERE service_name = $1`;
    params.push(service);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limitValue, offsetValue);

  try {
    const [result, totalResult] = await Promise.all([
      pool.query(query, params),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM diagnosis_tickets
         ${service ? "WHERE service_name = $1" : ""}`,
        service ? [service] : []
      ),
    ]);

    const total = Number(totalResult.rows[0]?.total ?? 0);
    const totalPages = limitValue > 0 ? Math.max(1, Math.ceil(total / limitValue)) : 1;

    return res.json({
      data: result.rows,
      pagination: {
        page: computedPage,
        size: limitValue,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Erro ao listar tickets:", error);
    return sendProblem(res, 500, "Erro interno", "Falha ao consultar tickets");
  }
});

// POST /api/v1/tickets/:id/feedback
router.post("/:id/feedback", async (req, res) => {
  const { id } = req.params;
  const { useful, applied, comment } = req.body as FeedbackRequest;

  if (!UUID_REGEX.test(id)) {
    return sendProblem(res, 400, "Requisição inválida", "ID inválido");
  }

  if (typeof useful !== "boolean" || typeof applied !== "boolean") {
    return sendProblem(
      res,
      400,
      "Requisição inválida",
      "Campos useful e applied são obrigatórios (boolean)"
    );
  }

  try {
    const result = await pool.query(
      `UPDATE diagnosis_tickets
       SET feedback_useful = $1, feedback_applied = $2, feedback_comment = $3,
           feedback_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [useful, applied, comment ?? null, id]
    );

    if (result.rows.length === 0) {
      return sendProblem(res, 404, "Recurso não encontrado", "Ticket não encontrado");
    }

    return res.json({ success: true, message: "Feedback registrado" });
  } catch (error) {
    console.error("Erro ao registrar feedback:", error);
    return sendProblem(res, 500, "Erro interno", "Falha ao registrar feedback");
  }
});

export default router;
