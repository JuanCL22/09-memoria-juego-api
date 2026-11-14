import { ApiError } from "@/src/lib/errors";
import type { LoginInput, RefreshInput, RegistroInput } from "@/src/schemas/auth.schema";

export interface RespuestaSesion {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: {
    id: string;
    email: string;
  };
}

export interface RespuestaRefresh {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
}

interface FirebaseAuthSuccess {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email: string;
}

interface FirebaseRefreshSuccess {
  id_token: string;
  refresh_token: string;
  expires_in: string;
}

interface FirebaseErrorPayload {
  error?: {
    message?: string;
  };
}

function obtenerWebApiKey(): string {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new ApiError(500, "Error interno");
  }
  return apiKey;
}

export function mapearErrorFirebaseAuth(codigoRaw: string): ApiError {
  const codigo = (codigoRaw.split(":")[0] ?? "").trim();

  if (codigo === "EMAIL_EXISTS") {
    return new ApiError(409, "El correo electrónico ya está registrado");
  }
  if (
    codigo === "EMAIL_NOT_FOUND" ||
    codigo === "INVALID_PASSWORD" ||
    codigo === "INVALID_LOGIN_CREDENTIALS" ||
    codigo === "USER_DISABLED"
  ) {
    return new ApiError(401, "Credenciales inválidas");
  }
  if (codigo === "WEAK_PASSWORD") {
    return new ApiError(400, "La contraseña es demasiado débil");
  }
  if (codigo === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return new ApiError(429, "Demasiados intentos. Intente más tarde");
  }
  return new ApiError(401, "No fue posible autenticar la solicitud");
}

async function invocarIdentityToolkit(
  endpoint: "accounts:signUp" | "accounts:signInWithPassword",
  datos: { email: string; password: string }
): Promise<RespuestaSesion> {
  const apiKey = obtenerWebApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: datos.email,
      password: datos.password,
      returnSecureToken: true
    })
  });

  if (!respuesta.ok) {
    const errBody = (await respuesta.json().catch(() => ({}))) as FirebaseErrorPayload;
    throw mapearErrorFirebaseAuth(errBody.error?.message ?? "AUTH_ERROR");
  }

  const cuerpo = (await respuesta.json()) as FirebaseAuthSuccess;
  return {
    token: cuerpo.idToken,
    refreshToken: cuerpo.refreshToken,
    expiraEnSeg: Number(cuerpo.expiresIn) || 3600,
    usuario: {
      id: cuerpo.localId,
      email: cuerpo.email
    }
  };
}

export async function registrarUsuario(input: RegistroInput): Promise<RespuestaSesion> {
  return invocarIdentityToolkit("accounts:signUp", input);
}

export async function iniciarSesion(input: LoginInput): Promise<RespuestaSesion> {
  return invocarIdentityToolkit("accounts:signInWithPassword", input);
}

export async function renovarToken(input: RefreshInput): Promise<RespuestaRefresh> {
  const apiKey = obtenerWebApiKey();
  const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken
    }).toString()
  });

  if (!respuesta.ok) {
    throw new ApiError(401, "El refreshToken es inválido o ha expirado");
  }

  const cuerpo = (await respuesta.json()) as FirebaseRefreshSuccess;
  return {
    token: cuerpo.id_token,
    refreshToken: cuerpo.refresh_token,
    expiraEnSeg: Number(cuerpo.expires_in) || 3600
  };
}
