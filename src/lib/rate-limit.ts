import { ApiError } from "@/src/lib/errors";

interface RegistroVentana {
  conteo: number;
  expiraEnMs: number;
}

const ventanas = new Map<string, RegistroVentana>();

export function verificarRateLimit(
  clave: string,
  maxIntentos: number,
  ventanaMs = 60_000,
  ahoraMs = Date.now()
): void {
  const actual = ventanas.get(clave);

  if (!actual || ahoraMs >= actual.expiraEnMs) {
    ventanas.set(clave, {
      conteo: 1,
      expiraEnMs: ahoraMs + ventanaMs
    });
    return;
  }

  if (actual.conteo >= maxIntentos) {
    throw new ApiError(
      429,
      "Demasiadas solicitudes. Por favor intente de nuevo en un minuto."
    );
  }

  actual.conteo += 1;
}

export function limpiarRateLimits(): void {
  ventanas.clear();
}
