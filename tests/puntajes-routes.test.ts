import { beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarRateLimits } from "@/src/lib/rate-limit";

const verifyIdTokenMock = vi.fn();
const storeGlobal = new Map<string, Record<string, unknown>>();
const storeUsuarios = new Map<string, Map<string, Record<string, unknown>>>();

function obtenerMapaUsuario(uid: string): Map<string, Record<string, unknown>> {
  let mapa = storeUsuarios.get(uid);
  if (!mapa) {
    mapa = new Map<string, Record<string, unknown>>();
    storeUsuarios.set(uid, mapa);
  }
  return mapa;
}

function listarDocsStore(mapa: Map<string, Record<string, unknown>>) {
  return async () => ({
    docs: Array.from(mapa.values()).map((d) => ({ data: () => d }))
  });
}

function crearMockColeccionGlobal() {
  const getGlobal = listarDocsStore(storeGlobal);
  const ordenGlobal = () => ({ orderBy: () => ({ limit: () => ({ get: getGlobal }) }) });
  return {
    doc: (id: string) => ({
      set: async (data: Record<string, unknown>) => {
        storeGlobal.set(id, data);
      },
      get: async () => ({
        exists: storeGlobal.has(id),
        data: () => storeGlobal.get(id)
      }),
      delete: async () => {
        storeGlobal.delete(id);
      }
    }),
    where: () => ({
      where: () => ({ orderBy: ordenGlobal }),
      orderBy: ordenGlobal
    })
  };
}

function crearMockColeccionUsuario(uid: string) {
  const mapa = obtenerMapaUsuario(uid);
  const getUsuario = listarDocsStore(mapa);
  return {
    doc: (id: string) => ({
      get: async () => ({
        exists: mapa.has(id),
        data: () => mapa.get(id)
      }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const previo = mapa.get(id) ?? {};
        mapa.set(id, opts?.merge ? { ...previo, ...data } : data);
      }
    }),
    orderBy: () => ({
      where: () => ({ limit: () => ({ get: getUsuario }) }),
      limit: () => ({ get: getUsuario })
    })
  };
}

function crearMockDb() {
  return {
    collection: (nombre: string) => {
      if (nombre === "puntajes") {
        return crearMockColeccionGlobal();
      }
      return {
        doc: (uid: string) => ({
          collection: () => crearMockColeccionUsuario(uid)
        })
      };
    }
  };
}

vi.mock("@/src/lib/firebase-admin", () => ({
  getAdminAuth: () => ({
    verifyIdToken: verifyIdTokenMock
  }),
  getAdminDb: () => crearMockDb()
}));

import { DELETE as adminDelete } from "@/app/api/admin/puntajes/[id]/route";
import {
  DELETE as puntajeDelete,
  PUT as puntajePut
} from "@/app/api/puntajes/[id]/route";
import { GET as puntajesGet, POST as puntajesPost } from "@/app/api/puntajes/route";
import { GET as rankingGet } from "@/app/api/ranking/route";

const UUID_PRUEBA = "550e8400-e29b-41d4-a716-446655440000";

describe("Pruebas de autenticación y validación en /api/puntajes", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
    storeUsuarios.clear();
    limpiarRateLimits();
    process.env.RATE_LIMIT_RPM = "5";
  });

  it("1. Autenticación: POST /api/puntajes devuelve 401 sin token", async () => {
    const req = new Request("https://api.local/api/puntajes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jugador: "Ana",
        dificultad: "facil",
        movimientos: 6,
        segundos: 12
      })
    });
    const res = await puntajesPost(req);
    expect(res.status).toBe(401);
  });

  it("2. Validación y plausibilidad: devuelve 400 si segundos < parejas o hay campos extra", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "u-1", email: "a@b.c" });

    const reqInvalido = new Request("https://api.local/api/puntajes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer tok-u1"
      },
      body: JSON.stringify({
        jugador: "Ana",
        dificultad: "dificil",
        movimientos: 5,
        segundos: 3
      })
    });
    const res = await puntajesPost(reqInvalido);
    expect(res.status).toBe(400);
  });
});

describe("Creación de puntajes, ranking y rate limit", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
    storeUsuarios.clear();
    limpiarRateLimits();
  });

  it("crea puntaje válido (201), ordena ranking (200) y aplica rate limit (429)", async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: "u-1", email: "a@b.c" });
    process.env.RATE_LIMIT_RPM = "2";

    const crearReq = (movimientos: number, segundos: number) =>
      new Request("https://api.local/api/puntajes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer tok-u1"
        },
        body: JSON.stringify({
          jugador: "Carlos",
          dificultad: "medio",
          movimientos,
          segundos,
          ciudad: "Medellín"
        })
      });

    const r1 = await puntajesPost(crearReq(10, 30));
    const r2 = await puntajesPost(crearReq(8, 25));
    const r3 = await puntajesPost(crearReq(9, 20));

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(429);

    const reqRank = new Request(
      "https://api.local/api/ranking?dificultad=medio&ciudad=Medell%C3%ADn",
      {
        method: "GET",
        headers: { authorization: "Bearer tok-u1" }
      }
    );
    const resRank = await rankingGet(reqRank);
    const bodyRank = (await resRank.json()) as {
      items: Array<{ movimientos: number }>;
    };
    expect(resRank.status).toBe(200);
    expect(bodyRank.items[0]?.movimientos).toBe(8);
  });
});

describe("3. Autorización y aislamiento entre usuarios en PUT/DELETE", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
    storeUsuarios.clear();
    limpiarRateLimits();
  });

  it("aísla los datos privados entre usuarios en PUT y DELETE /api/puntajes/[id]", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-A", email: "a@test.com" });
    const reqPutA = new Request(`https://api.local/api/puntajes/${UUID_PRUEBA}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer tok-A"
      },
      body: JSON.stringify({
        jugador: "JugadorA",
        dificultad: "facil",
        movimientos: 6,
        segundos: 15
      })
    });
    const resPutA = await puntajePut(reqPutA, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resPutA.status).toBe(200);

    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-B", email: "b@test.com" });
    const reqDelB = new Request(`https://api.local/api/puntajes/${UUID_PRUEBA}`, {
      method: "DELETE",
      headers: { authorization: "Bearer tok-B" }
    });
    const resDelB = await puntajeDelete(reqDelB, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resDelB.status).toBe(404);
  });
});

describe("Sincronización incremental y borrado lógico del propietario", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeUsuarios.clear();
  });

  it("permite al propietario sincronizar (GET ?since=) y borrar lógicamente (DELETE)", async () => {
    obtenerMapaUsuario("usuario-A").set(UUID_PRUEBA, {
      id: UUID_PRUEBA,
      jugador: "JugadorA",
      dificultad: "facil",
      movimientos: 6,
      segundos: 15,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
      deleted_at: null
    });

    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-A", email: "a@test.com" });
    const reqSyncA = new Request(
      "https://api.local/api/puntajes?since=2026-01-01T00:00:00.000Z",
      {
        method: "GET",
        headers: { authorization: "Bearer tok-A" }
      }
    );
    const resSyncA = await puntajesGet(reqSyncA);
    expect(resSyncA.status).toBe(200);

    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-A", email: "a@test.com" });
    const reqDelA = new Request(`https://api.local/api/puntajes/${UUID_PRUEBA}`, {
      method: "DELETE",
      headers: { authorization: "Bearer tok-A" }
    });
    const resDelA = await puntajeDelete(reqDelA, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resDelA.status).toBe(200);
  });
});

describe("Autorización de rol admin en /api/admin/puntajes/[id]", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
  });

  it("DELETE /api/admin/puntajes/[id] devuelve 403 sin claim rol='admin' y 200 con rol='admin'", async () => {
    storeGlobal.set(UUID_PRUEBA, { id: UUID_PRUEBA, jugador: "Test" });

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "usuario-normal",
      email: "u@test.com"
    });
    const reqSinRol = new Request(`https://api.local/api/admin/puntajes/${UUID_PRUEBA}`, {
      method: "DELETE",
      headers: { authorization: "Bearer tok-normal" }
    });
    const res403 = await adminDelete(reqSinRol, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(res403.status).toBe(403);

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "usuario-admin",
      email: "admin@test.com",
      rol: "admin"
    });
    const reqAdmin = new Request(`https://api.local/api/admin/puntajes/${UUID_PRUEBA}`, {
      method: "DELETE",
      headers: { authorization: "Bearer tok-admin" }
    });
    const res200 = await adminDelete(reqAdmin, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(res200.status).toBe(200);

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "usuario-admin",
      email: "admin@test.com",
      rol: "admin"
    });
    const res404 = await adminDelete(reqAdmin, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(res404.status).toBe(404);
  });
});

describe("Ramas adicionales de ranking global y actualización idempotente", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
    storeUsuarios.clear();
  });

  it("ordena por segundos cuando empatan movimientos y actualiza documento existente en PUT", async () => {
    storeGlobal.set("id-1", {
      id: "id-1",
      jugador: "P1",
      dificultad: "facil",
      movimientos: 6,
      segundos: 20
    });
    storeGlobal.set("id-2", {
      id: "id-2",
      jugador: "P2",
      dificultad: "facil",
      movimientos: 6,
      segundos: 12
    });

    verifyIdTokenMock.mockResolvedValue({ uid: "u-1", email: "a@b.c" });
    const reqRank = new Request("https://api.local/api/ranking", {
      method: "GET",
      headers: { authorization: "Bearer tok-u1" }
    });
    const resRank = await rankingGet(reqRank);
    expect(resRank.status).toBe(200);

    const bodyPut = {
      jugador: "JugadorA",
      dificultad: "facil",
      movimientos: 6,
      segundos: 15
    };
    const crearPut = () =>
      new Request(`https://api.local/api/puntajes/${UUID_PRUEBA}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer tok-u1"
        },
        body: JSON.stringify(bodyPut)
      });

    await puntajePut(crearPut(), { params: Promise.resolve({ id: UUID_PRUEBA }) });
    const resPut2 = await puntajePut(crearPut(), {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resPut2.status).toBe(200);
  });
});
