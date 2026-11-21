import { beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarRateLimits } from "@/src/lib/rate-limit";

const verifyIdTokenMock = vi.fn();

vi.mock("@/src/lib/firebase-admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock
  }),
  getAdminDb: () => ({})
}));

import { GET as healthGet } from "@/app/api/health/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as refreshPost } from "@/app/api/auth/refresh/route";
import { POST as registroPost } from "@/app/api/auth/registro/route";
import { GET as yoGet } from "@/app/api/auth/yo/route";
import { mapearErrorFirebaseAuth } from "@/src/services/auth.service";

function crearRequestJson(
  url: string,
  metodo: string,
  cuerpo: unknown,
  token?: string
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  return new Request(url, {
    method: metodo,
    headers,
    body: JSON.stringify(cuerpo)
  });
}

describe("Salud y verificación de sesión (/api/health y /api/auth/yo)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    verifyIdTokenMock.mockReset();
    limpiarRateLimits();
    process.env.FIREBASE_WEB_API_KEY = "AIzaTestKeyFalsa";
  });

  it("GET /api/health responde 200 ok", async () => {
    const res = await healthGet();
    const json = (await res.json()) as { ok: boolean; servicio: string };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.servicio).toBe("09-memoria-juego-api");
  });

  it("GET /api/auth/yo responde 401 sin token Bearer", async () => {
    const req = new Request("https://api.local/api/auth/yo", { method: "GET" });
    const res = await yoGet(req);
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/yo responde 200 con token verificado", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "user-123",
      email: "ana@test.com",
      rol: "admin"
    });
    const req = new Request("https://api.local/api/auth/yo", {
      method: "GET",
      headers: { authorization: "Bearer token-valido" }
    });
    const res = await yoGet(req);
    const json = (await res.json()) as {
      usuario: { id: string; email: string; rol: string };
    };
    expect(res.status).toBe(200);
    expect(json.usuario.id).toBe("user-123");
    expect(json.usuario.rol).toBe("admin");
  });
});

describe("Registro de usuario (/api/auth/registro)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    limpiarRateLimits();
    process.env.FIREBASE_WEB_API_KEY = "AIzaTestKeyFalsa";
  });

  it("POST /api/auth/registro devuelve 400 si la contraseña tiene menos de 8 caracteres", async () => {
    const req = crearRequestJson("https://api.local/api/auth/registro", "POST", {
      email: "nuevo@test.com",
      password: "123"
    });
    const res = await registroPost(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/registro devuelve 201 cuando Firebase registra el usuario", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "id-tok-1",
          refreshToken: "ref-tok-1",
          expiresIn: "3600",
          localId: "uid-nuevo",
          email: "nuevo@test.com"
        }),
        { status: 200 }
      )
    );
    const req = crearRequestJson("https://api.local/api/auth/registro", "POST", {
      email: "nuevo@test.com",
      password: "passwordSegura123"
    });
    const res = await registroPost(req);
    expect(res.status).toBe(201);
  });
});

describe("Mapeo de errores y login (/api/auth/login)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    limpiarRateLimits();
    process.env.FIREBASE_WEB_API_KEY = "AIzaTestKeyFalsa";
  });

  it("devuelve 409 cuando el correo ya existe y 401 con idéntico mensaje para credenciales inválidas", () => {
    const errRepetido = mapearErrorFirebaseAuth("EMAIL_EXISTS");
    const errNoExiste = mapearErrorFirebaseAuth("EMAIL_NOT_FOUND");
    const errClaveMal = mapearErrorFirebaseAuth("INVALID_PASSWORD");
    const errDebil = mapearErrorFirebaseAuth("WEAK_PASSWORD : Password should be...");
    const errLimite = mapearErrorFirebaseAuth("TOO_MANY_ATTEMPTS_TRY_LATER");

    expect(errRepetido.status).toBe(409);
    expect(errNoExiste.status).toBe(401);
    expect(errClaveMal.status).toBe(401);
    expect(errNoExiste.message).toBe(errClaveMal.message);
    expect(errDebil.status).toBe(400);
    expect(errLimite.status).toBe(429);
  });

  it("POST /api/auth/login responde 200 con credenciales válidas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idToken: "tok-login",
          refreshToken: "ref-login",
          expiresIn: "3600",
          localId: "uid-1",
          email: "jugador@test.com"
        }),
        { status: 200 }
      )
    );
    const req = crearRequestJson("https://api.local/api/auth/login", "POST", {
      email: "jugador@test.com",
      password: "password123"
    });
    const res = await loginPost(req);
    expect(res.status).toBe(200);
  });
});

describe("Renovación de token (/api/auth/refresh)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    limpiarRateLimits();
    process.env.FIREBASE_WEB_API_KEY = "AIzaTestKeyFalsa";
  });

  it("POST /api/auth/refresh renueva el token (200) o rechaza token inválido (401)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id_token: "nuevo-id-token",
          refresh_token: "nuevo-refresh-token",
          expires_in: "3600"
        }),
        { status: 200 }
      )
    );
    const reqOk = crearRequestJson("https://api.local/api/auth/refresh", "POST", {
      refreshToken: "refresh-token-valido-12345"
    });
    const resOk = await refreshPost(reqOk);
    expect(resOk.status).toBe(200);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "TOKEN_EXPIRED" } }), {
        status: 400
      })
    );
    const reqFail = crearRequestJson("https://api.local/api/auth/refresh", "POST", {
      refreshToken: "refresh-token-expirado-123"
    });
    const resFail = await refreshPost(reqFail);
    expect(resFail.status).toBe(401);
  });
});
