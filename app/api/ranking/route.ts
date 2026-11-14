import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth-middleware";
import { manejarExcepcion } from "@/src/lib/errors";
import { rankingQuerySchema } from "@/src/schemas/puntaje.schema";
import { obtenerRanking } from "@/src/services/puntajes.service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await verificarToken(request);

    const url = new URL(request.url);
    const dificultadParam = url.searchParams.get("dificultad") ?? undefined;
    const ciudadParam = url.searchParams.get("ciudad") ?? undefined;

    const filtro = rankingQuerySchema.parse({
      dificultad: dificultadParam,
      ciudad: ciudadParam
    });

    const items = await obtenerRanking(filtro);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
