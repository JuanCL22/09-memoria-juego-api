import { NextResponse } from "next/server";
import { verificarToken } from "@/src/lib/auth-middleware";
import { manejarExcepcion } from "@/src/lib/errors";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const usuario = await verificarToken(request);
    return NextResponse.json(
      {
        usuario: {
          id: usuario.uid,
          email: usuario.email,
          rol: usuario.rol
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return manejarExcepcion(error);
  }
}
