import { NextResponse } from "next/server";
import { verificarAdmin } from "@/src/lib/auth-middleware";
import { manejarExcepcion } from "@/src/lib/errors";
import { uuidSchema } from "@/src/schemas/puntaje.schema";
import { eliminarPuntajeGlobalAdmin } from "@/src/services/puntajes.service";

export const runtime = "nodejs";

interface ContextoRuta {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  request: Request,
  contexto: ContextoRuta
): Promise<NextResponse> {
  try {
    await verificarAdmin(request);
    const { id } = await contexto.params;
    const idValidado = uuidSchema.parse(id);

    const resultado = await eliminarPuntajeGlobalAdmin(idValidado);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
