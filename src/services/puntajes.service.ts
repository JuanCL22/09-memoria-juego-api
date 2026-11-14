import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/lib/errors";
import { getAdminDb } from "@/src/lib/firebase-admin";
import { verificarRateLimit } from "@/src/lib/rate-limit";
import type { Dificultad, PuntajeInput, RankingQuery } from "@/src/schemas/puntaje.schema";

export interface DocumentoPuntajePrivado {
  id: string;
  user_id: string;
  jugador: string;
  dificultad: Dificultad;
  movimientos: number;
  segundos: number;
  ciudad: string | null;
  jugado_en: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentoPuntajeGlobal {
  id: string;
  user_id: string;
  jugador: string;
  dificultad: Dificultad;
  movimientos: number;
  segundos: number;
  ciudad: string | null;
  creada_en: string;
}

export interface RespuestaSincronizacion {
  items: DocumentoPuntajePrivado[];
  servidor_ahora: string;
}

function obtenerLimitePartidasPorMinuto(): number {
  const valor = Number(process.env.RATE_LIMIT_RPM ?? "10");
  return Number.isFinite(valor) && valor > 0 ? valor : 10;
}

function construirDocumentoPrivado(
  uid: string,
  id: string,
  input: PuntajeInput,
  ahoraIso: string,
  createdAtPrevio?: string
): DocumentoPuntajePrivado {
  return {
    id,
    user_id: uid,
    jugador: input.jugador,
    dificultad: input.dificultad,
    movimientos: input.movimientos,
    segundos: input.segundos,
    ciudad: input.ciudad ?? null,
    jugado_en: input.jugado_en ?? ahoraIso,
    created_at: createdAtPrevio ?? ahoraIso,
    updated_at: ahoraIso,
    deleted_at: null
  };
}

export function ordenarPorMovimientosYTiempo<
  T extends { movimientos: number; segundos: number }
>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.movimientos !== b.movimientos) {
      return a.movimientos - b.movimientos;
    }
    return a.segundos - b.segundos;
  });
}

export async function crearPuntaje(
  uid: string,
  input: PuntajeInput
): Promise<DocumentoPuntajePrivado> {
  verificarRateLimit(`puntajes:${uid}`, obtenerLimitePartidasPorMinuto());

  const ahoraIso = new Date().toISOString();
  const id = input.id ?? randomUUID();
  const docPrivado = construirDocumentoPrivado(uid, id, input, ahoraIso);
  const docGlobal: DocumentoPuntajeGlobal = {
    id,
    user_id: uid,
    jugador: docPrivado.jugador,
    dificultad: docPrivado.dificultad,
    movimientos: docPrivado.movimientos,
    segundos: docPrivado.segundos,
    ciudad: docPrivado.ciudad,
    creada_en: ahoraIso
  };

  const db = getAdminDb();
  await db.collection("puntajes").doc(id).set(docGlobal);
  await db
    .collection("usuarios")
    .doc(uid)
    .collection("puntajes")
    .doc(id)
    .set(docPrivado);

  return docPrivado;
}

export async function obtenerRanking(
  filtro: RankingQuery
): Promise<DocumentoPuntajeGlobal[]> {
  const db = getAdminDb();
  let queryRef = db
    .collection("puntajes")
    .where("dificultad", "==", filtro.dificultad);

  if (filtro.ciudad !== null) {
    queryRef = queryRef.where("ciudad", "==", filtro.ciudad);
  }

  const snapshot = await queryRef
    .orderBy("movimientos", "asc")
    .orderBy("segundos", "asc")
    .limit(10)
    .get();

  const items = snapshot.docs.map(
    (doc) => doc.data() as DocumentoPuntajeGlobal
  );
  return ordenarPorMovimientosYTiempo(items).slice(0, 10);
}

export async function listarPuntajesSincronizacion(
  uid: string,
  since?: string
): Promise<RespuestaSincronizacion> {
  const db = getAdminDb();
  const servidorAhora = new Date().toISOString();
  let queryRef = db
    .collection("usuarios")
    .doc(uid)
    .collection("puntajes")
    .orderBy("updated_at", "asc");

  if (since) {
    queryRef = queryRef.where("updated_at", ">", since);
  }

  const snapshot = await queryRef.limit(500).get();
  const items = snapshot.docs.map(
    (doc) => doc.data() as DocumentoPuntajePrivado
  );

  return {
    items,
    servidor_ahora: servidorAhora
  };
}

export async function guardarPuntajeSincronizado(
  uid: string,
  id: string,
  input: PuntajeInput
): Promise<DocumentoPuntajePrivado> {
  const db = getAdminDb();
  const ahoraIso = new Date().toISOString();
  const docRef = db
    .collection("usuarios")
    .doc(uid)
    .collection("puntajes")
    .doc(id);

  const existente = await docRef.get();
  const datosPrevios = existente.exists
    ? (existente.data() as Partial<DocumentoPuntajePrivado>)
    : undefined;

  const docPrivado = construirDocumentoPrivado(
    uid,
    id,
    input,
    ahoraIso,
    datosPrevios?.created_at
  );

  await docRef.set(docPrivado);
  return docPrivado;
}

export async function eliminarPuntajeSincronizado(
  uid: string,
  id: string
): Promise<{ ok: true }> {
  const db = getAdminDb();
  const docRef = db
    .collection("usuarios")
    .doc(uid)
    .collection("puntajes")
    .doc(id);

  const existente = await docRef.get();
  if (!existente.exists) {
    throw new ApiError(404, "El puntaje solicitado no existe");
  }

  const ahoraIso = new Date().toISOString();
  await docRef.set(
    {
      updated_at: ahoraIso,
      deleted_at: ahoraIso
    },
    { merge: true }
  );

  return { ok: true };
}

export async function eliminarPuntajeGlobalAdmin(id: string): Promise<{ ok: true }> {
  const db = getAdminDb();
  const docRef = db.collection("puntajes").doc(id);
  const existente = await docRef.get();
  if (!existente.exists) {
    throw new ApiError(404, "El puntaje global no existe");
  }
  await docRef.delete();
  return { ok: true };
}
