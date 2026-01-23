import { Pool } from "pg";

const port = Number(process.env.POSTGRES_PORT ?? 5432);

const pool = new Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number.isNaN(port) ? 5432 : port,
  database: process.env.POSTGRES_DB ?? "troubleshooting",
  user: process.env.POSTGRES_USER ?? "troubleshooting",
  password: process.env.POSTGRES_PASSWORD ?? "change-me-in-production",
});

pool.on("error", (error) => {
  console.error("Erro inesperado na conexão com PostgreSQL:", error);
});

export default pool;
