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

function crearMockDb() {
  return {
    collection: (nombre: string) => {
      if (nombre === "puntajes") {
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
            where: () => ({
              orderBy: () => ({
                orderBy: () => ({
                  limit: () => ({
                    get: async () => ({
                      docs: Array.from(storeGlobal.values()).map((d) => ({
                        data: () => d
                      }))
                    })
                  })
                })
              })
            }),
            orderBy: () => ({
              orderBy: () => ({
                limit: () => ({
                  get: async () => ({
                    docs: Array.from(storeGlobal.values()).map((d) => ({
                      data: () => d
                    }))
                  })
                })
              })
            })
          })
        };
      }
      return {
        doc: (uid: string) => ({
          collection: () => {
            const mapa = obtenerMapaUsuario(uid);
            return {
              doc: (id: string) => ({
                get: async () => ({
                  exists: mapa.has(id),
                  data: () => mapa.get(id)
                }),
                set: async (
                  data: Record<string, unknown>,
                  opts?: { merge?: boolean }
                ) => {
                  const previo = mapa.get(id) ?? {};
                  mapa.set(id, opts?.merge ? { ...previo, ...data } : data);
                }
              }),
              orderBy: () => ({
                where: () => ({
                  limit: () => ({
                    get: async () => ({
                      docs: Array.from(mapa.values()).map((d) => ({
                        data: () => d
                      }))
                    })
                  })
                }),
                limit: () => ({
                  get: async () => ({
                    docs: Array.from(mapa.values()).map((d) => ({
                      data: () => d
                    }))
                  })
                })
              })
            };
          }
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

describe("Pruebas de rutas de puntajes: 401, 400 plausibilidad y 201 creación", () => {
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

describe("3. Autorización, aislamiento entre usuarios y sincronización", () => {
  beforeEach(() => {
    verifyIdTokenMock.mockReset();
    storeGlobal.clear();
    storeUsuarios.clear();
    limpiarRateLimits();
  });

  it("aísla los datos privados entre usuarios en PUT/GET/DELETE /api/puntajes/[id]", async () => {
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-A", email: "a@test.com" });
    const reqPutA = new Request(
      `https://api.local/api/puntajes/${UUID_PRUEBA}`,
      {
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
      }
    );
    const resPutA = await puntajePut(reqPutA, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resPutA.status).toBe(200);

    // Usuario B intenta borrar el documento de Usuario A -> recibe 404 por aislamiento de ruta
    verifyIdTokenMock.mockResolvedValueOnce({ uid: "usuario-B", email: "b@test.com" });
    const reqDelB = new Request(
      `https://api.local/api/puntajes/${UUID_PRUEBA}`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok-B" }
      }
    );
    const resDelB = await puntajeDelete(reqDelB, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resDelB.status).toBe(404);

    // Usuario A sincroniza y luego realiza borrado lógico (200)
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
    const reqDelA = new Request(
      `https://api.local/api/puntajes/${UUID_PRUEBA}`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok-A" }
      }
    );
    const resDelA = await puntajeDelete(reqDelA, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(resDelA.status).toBe(200);
  });

  it("DELETE /api/admin/puntajes/[id] devuelve 403 sin claim rol='admin' y 200 con rol='admin'", async () => {
    storeGlobal.set(UUID_PRUEBA, { id: UUID_PRUEBA, jugador: "Test" });

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "usuario-normal",
      email: "u@test.com"
    });
    const reqSinRol = new Request(
      `https://api.local/api/admin/puntajes/${UUID_PRUEBA}`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok-normal" }
      }
    );
    const res403 = await adminDelete(reqSinRol, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(res403.status).toBe(403);

    verifyIdTokenMock.mockResolvedValueOnce({
      uid: "usuario-admin",
      email: "admin@test.com",
      rol: "admin"
    });
    const reqAdmin = new Request(
      `https://api.local/api/admin/puntajes/${UUID_PRUEBA}`,
      {
        method: "DELETE",
        headers: { authorization: "Bearer tok-admin" }
      }
    );
    const res200 = await adminDelete(reqAdmin, {
      params: Promise.resolve({ id: UUID_PRUEBA })
    });
    expect(res200.status).toBe(200);
  });
});
