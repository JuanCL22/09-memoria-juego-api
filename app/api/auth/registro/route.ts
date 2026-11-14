import { NextResponse } from "next/server";
import { leerJsonSeguro, manejarExcepcion } from "@/src/lib/errors";
import { registroSchema } from "@/src/schemas/auth.schema";
import { registrarUsuario } from "@/src/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await leerJsonSeguro(request);
    const datos = registroSchema.parse(body);
    const sesion = await registrarUsuario(datos);
    return NextResponse.json(sesion, { status: 201 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
