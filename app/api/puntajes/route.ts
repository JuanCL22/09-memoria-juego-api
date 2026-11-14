import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth-middleware";
import { leerJsonSeguro, manejarExcepcion } from "@/src/lib/errors";
import { puntajeInputSchema, sinceQuerySchema } from "@/src/schemas/puntaje.schema";
import {
  crearPuntaje,
  listarPuntajesSincronizacion
} from "@/src/services/puntajes.service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const usuario = await verificarToken(request);
    const url = new URL(request.url);
    const sinceRaw = url.searchParams.get("since") ?? undefined;
    const { since } = sinceQuerySchema.parse({ since: sinceRaw });

    const respuesta = await listarPuntajesSincronizacion(usuario.uid, since);
    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await verificarToken(request);
    const body = await leerJsonSeguro(request);
    const datos = puntajeInputSchema.parse(body);

    const creado = await crearPuntaje(usuario.uid, datos);
    return NextResponse.json(creado, { status: 201 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
