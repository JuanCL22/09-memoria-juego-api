import { NextResponse } from "next/server";
import { leerJsonSeguro, manejarExcepcion } from "@/src/lib/errors";
import { verificarRateLimit } from "@/src/lib/rate-limit";
import { loginSchema } from "@/src/schemas/auth.schema";
import { iniciarSesion } from "@/src/services/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    verificarRateLimit(`login:${ip}`, 10);

    const body = await leerJsonSeguro(request);
    const datos = loginSchema.parse(body);
    const sesion = await iniciarSesion(datos);
    return NextResponse.json(sesion, { status: 200 });
  } catch (error) {
    return manejarExcepcion(error);
  }
}
