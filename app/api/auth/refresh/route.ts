import { NextResponse } from "next/server";
import { leerJsonSeguro, manejarExcepcion } from "@/src/lib/errors";
import { refreshSchema } from "@/src/schemas/auth.schema";
import { renovarToken } from "@/src/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await leerJsonSeguro(request);
    const datos = refreshSchema.parse(body);
    const renovado = await renovarToken(datos);
    return NextResponse.json(renovado, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
