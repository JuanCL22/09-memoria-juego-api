import { ApiError } from "@/src/lib/errors";
import { getAdminAuth } from "@/src/lib/firebase-admin";

export interface UsuarioAutenticado {
  uid: string;
  email: string | null;
  rol: string | null;
}

function extraerBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new ApiError(401, "Token de autenticación requerido");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token === "") {
    throw new ApiError(401, "Token de autenticación vacío");
  }
  return token;
}

export async function verificarToken(request: Request): Promise<UsuarioAutenticado> {
  const token = extraerBearerToken(request);

  try {
    const decodificado = await getAdminAuth().verifyIdToken(token);
    const rolClaim = decodificado["rol"];
    const rol = typeof rolClaim === "string" ? rolClaim : null;

    return {
      uid: decodificado.uid,
      email: decodificado.email ?? null,
      rol
    };
  } catch {
    throw new ApiError(401, "Token inválido o expirado");
  }
}

export async function verificarAdmin(request: Request): Promise<UsuarioAutenticado> {
  const usuario = await verificarToken(request);
  if (usuario.rol !== "admin") {
    throw new ApiError(403, "Se requiere rol de administrador para esta operación");
  }
  return usuario;
}
