import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface CuerpoError {
  error: string;
  detalles?: DetalleError[];
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly detalles?: DetalleError[];

  constructor(status: number, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
    this.detalles = detalles;
  }
}

export function respuestaError(
  status: number,
  mensaje: string,
  detalles?: DetalleError[]
): NextResponse<CuerpoError> {
  const cuerpo: CuerpoError =
    detalles && detalles.length > 0 ? { error: mensaje, detalles } : { error: mensaje };
  return NextResponse.json(cuerpo, { status });
}

export function formatearZodError(error: ZodError): NextResponse<CuerpoError> {
  const detalles: DetalleError[] = error.issues.map((issue) => ({
    campo: issue.path.length > 0 ? issue.path.join(".") : "cuerpo",
    mensaje: issue.message
  }));
  return respuestaError(400, "Datos de entrada inválidos", detalles);
}

export function manejarExcepcion(error: unknown): NextResponse<CuerpoError> {
  if (error instanceof ZodError) {
    return formatearZodError(error);
  }
  if (error instanceof ApiError) {
    return respuestaError(error.status, error.message, error.detalles);
  }
  return respuestaError(500, "Error interno");
}

export async function leerJsonSeguro(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "El encabezado Content-Type debe ser application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "El cuerpo de la petición no es un JSON válido");
  }
}
