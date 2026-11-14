import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth-middleware";
import { leerJsonSeguro, manejarExcepcion } from "@/src/lib/errors";
import { puntajeInputSchema, uuidSchema } from "@/src/schemas/puntaje.schema";
import {
  eliminarPuntajeSincronizado,
  guardarPuntajeSincronizado
} from "@/src/services/puntajes.service";

export const runtime = "nodejs";

interface ContextoRuta {
  params: Promise<{ id: string }>;
}

export async function PUT(
  request: Request,
  contexto: ContextoRuta
): Promise<NextResponse> {
  try {
    const usuario = await verificarToken(request);
    const { id } = await contexto.params;
    const idValidado = uuidSchema.parse(id);

    const body = await leerJsonSeguro(request);
    const datos = puntajeInputSchema.parse(body);

    const guardado = await guardarPuntajeSincronizado(
      usuario.uid,
      idValidado,
      datos
    );
    return NextResponse.json(guardado, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}

export async function DELETE(
  request: Request,
  contexto: ContextoRuta
): Promise<NextResponse> {
  try {
    const usuario = await verificarToken(request);
    const { id } = await contexto.params;
    const idValidado = uuidSchema.parse(id);

    const resultado = await eliminarPuntajeSincronizado(usuario.uid, idValidado);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
