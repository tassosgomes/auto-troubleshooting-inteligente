import express from "express";
import ticketsRouter from "./routes/tickets";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/v1/tickets", ticketsRouter);

app.use((_req, res) => {
  res
    .status(404)
    .type("application/problem+json")
    .json({
      type: "about:blank",
      title: "Recurso não encontrado",
      status: 404,
    });
});

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("Erro não tratado:", err);

  return res
    .status(500)
    .type("application/problem+json")
    .json({
      type: "about:blank",
      title: "Erro interno",
      status: 500,
      detail: "Erro inesperado no servidor",
    });
});

const port = Number(process.env.API_PORT ?? 3000);

app.listen(Number.isNaN(port) ? 3000 : port, () => {
  console.log(`API rodando na porta ${Number.isNaN(port) ? 3000 : port}`);
});
