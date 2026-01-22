import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("node-fetch", async () => {
  const actual = await vi.importActual<typeof import("node-fetch")>("node-fetch");
  return {
    ...actual,
    default: fetchMock,
  };
});

import { Headers } from "node-fetch";
import { httpRequest } from "../src/tools/network.js";

beforeEach(() => {
  fetchMock.mockReset();
});

describe("network tools", () => {
  it("retorna status e headers em resposta válida", async () => {
    fetchMock.mockResolvedValue({
      status: 204,
      headers: new Headers({ "content-type": "text/plain" }),
    });

    const result = await httpRequest("https://example.com", "HEAD", 5000);

    expect(result.status_code).toBe(204);
    expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.headers?.["content-type"]).toBe("text/plain");
  });

  it("retorna erro de timeout quando abortado", async () => {
    fetchMock.mockRejectedValue({ name: "AbortError" });

    const result = await httpRequest("https://example.com", "GET", 100);

    expect(result.status_code).toBeNull();
    expect(result.error).toBe("Timeout após 100ms");
  });

  it("retorna erro de DNS quando host não resolve", async () => {
    fetchMock.mockRejectedValue({ code: "ENOTFOUND" });

    const result = await httpRequest("https://example.com", "GET", 5000);

    expect(result.error).toBe("DNS não resolvido: example.com");
  });

  it("retorna erro de conexão recusada", async () => {
    fetchMock.mockRejectedValue({ code: "ECONNREFUSED" });

    const result = await httpRequest("http://localhost:1234", "GET", 5000);

    expect(result.error).toBe("Conexão recusada: http://localhost:1234");
  });
});