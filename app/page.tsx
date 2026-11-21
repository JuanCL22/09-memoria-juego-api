import type { ReactNode } from "react";

const ENDPOINTS: ReadonlyArray<{ readonly ruta: string; readonly desc: string }> = [
  { ruta: "GET /api/health", desc: "Estado del servicio" },
  { ruta: "POST /api/auth/registro", desc: "Registro mediado con Firebase Auth" },
  { ruta: "POST /api/auth/login", desc: "Inicio de sesión mediado" },
  { ruta: "POST /api/auth/refresh", desc: "Renovación de ID token" },
  { ruta: "GET /api/auth/yo", desc: "Perfil del usuario autenticado (Bearer)" },
  {
    ruta: "GET /api/ranking?dificultad=medio&ciudad=",
    desc: "Top 10 global o por ciudad"
  },
  { ruta: "POST /api/puntajes", desc: "Registrar nuevo puntaje validado" },
  { ruta: "GET /api/puntajes?since=<ISO>", desc: "Sincronización incremental" },
  { ruta: "PUT /api/puntajes/<id>", desc: "Creación o reemplazo idempotente" },
  { ruta: "DELETE /api/puntajes/<id>", desc: "Borrado lógico (deleted_at)" },
  { ruta: "DELETE /api/admin/puntajes/<id>", desc: "Administración (rol = admin)" }
];

export default function HomePage(): ReactNode {
  return (
    <main style={{ maxWidth: "820px", margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ color: "#2dd4bf", marginBottom: "8px" }}>
        09 · Juego de Memoria con Puntajes — API
      </h1>
      <p style={{ color: "#94a3b8", marginTop: 0 }}>
        Backend REST en Next.js (App Router, runtime Node.js) con Firebase Admin SDK y
        validación estricta mediante Zod.
      </p>
      <section
        style={{
          backgroundColor: "#1e293b",
          borderRadius: "12px",
          padding: "20px",
          marginTop: "24px"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "18px", color: "#38bdf8" }}>
          Endpoints disponibles
        </h2>
        <ul style={{ lineHeight: 1.8, color: "#e2e8f0" }}>
          {ENDPOINTS.map((ep) => (
            <li key={ep.ruta}>
              <code>{ep.ruta}</code> — {ep.desc}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
