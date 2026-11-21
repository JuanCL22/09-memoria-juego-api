import type { ReactNode } from "react";

export const metadata = {
  title: "09 · Juego de Memoria API",
  description: "API Backend (Next.js + Firebase Admin + Zod) para 09-memoria-juego"
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0f172a",
          color: "#f8fafc"
        }}
      >
        {children}
      </body>
    </html>
  );
}
