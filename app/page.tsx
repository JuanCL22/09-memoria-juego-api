import type { ReactNode } from "react";

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
          <li>
            <code>GET /api/health</code> — Estado del servicio
          </li>
          <li>
            <code>POST /api/auth/registro</code> — Registro mediado con Firebase Auth
          </li>
          <li>
            <code>POST /api/auth/login</code> — Inicio de sesión mediado
          </li>
          <li>
            <code>POST /api/auth/refresh</code> — Renovación de ID token
          </li>
          <li>
            <code>GET /api/auth/yo</code> — Perfil del usuario autenticado (Bearer)
          </li>
          <li>
            <code>GET /api/ranking?dificultad=medio&amp;ciudad=</code> — Top 10 global o
            por ciudad
          </li>
          <li>
            <code>POST /api/puntajes</code> — Registrar nuevo puntaje validado
          </li>
          <li>
            <code>GET /api/puntajes?since=&lt;ISO&gt;</code> — Sincronización incremental
          </li>
          <li>
            <code>PUT /api/puntajes/&lt;id&gt;</code> — Creación o reemplazo idempotente
          </li>
          <li>
            <code>DELETE /api/puntajes/&lt;id&gt;</code> — Borrado lógico (
            <code>deleted_at</code>)
          </li>
          <li>
            <code>DELETE /api/admin/puntajes/&lt;id&gt;</code> — Administración (requiere
            claim <code>rol = &quot;admin&quot;</code>)
          </li>
        </ul>
      </section>
    </main>
  );
}
