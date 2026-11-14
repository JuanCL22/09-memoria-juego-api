# Bitácora de Uso de IA — `09-memoria-juego-api`

Registro trazable de las sesiones de trabajo con IA siguiendo el método: **Propósito → Evidencia → Validación → Decisión**.

---

## Entradas de Desarrollo

### Sesión 1 — Configuración de IA, Sandbox y Hook `PreToolUse`
- **Propósito:** Establecer las barreras de seguridad (`.claude/settings.json`, `AGENTS.md`, hook `PreToolUse` y scripts de calidad) antes de escribir el código de la API.
- **Evidencia:** Creación de `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` y `.claude/hooks/pre-tool-use.mjs` con 10 pruebas en `.claude/hooks/pre-tool-use.test.mjs`.
- **Validación:** Ejecución de `npm run test:hook` (10/10 pruebas en verde) y verificación del primer commit en Git.
- **Decisión:** Aceptado e integrado en el primer commit del repositorio.

### Sesión 2 — Esquemas Zod y Reglas de Plausibilidad de Puntajes
- **Propósito:** Definir la validación estricta de entrada para autenticación (`registro`, `login`, `refresh`) y puntajes (`facil`, `medio`, `dificil`).
- **Evidencia:** Archivos `src/schemas/auth.schema.ts` y `src/schemas/puntaje.schema.ts`.
- **Validación:** Pruebas unitarias en Vitest verificando rechazo de campos extra (`.strict()`), nombres fuera de 2–15 caracteres y tiempos/movimientos físicamente imposibles (< 1 s por pareja).
- **Decisión:** Aceptado tras ajustar el cálculo de parejas por dificultad (4, 6 y 12 parejas).

### Sesión 3 — Endpoints de Autenticación Mediada, Ranking y Sincronización
- **Propósito:** Implementar Route Handlers de Next.js (`app/api/auth/*`, `app/api/puntajes/*`, `app/api/ranking`, `app/api/admin/puntajes/[id]`, `app/api/health`).
- **Evidencia:** Servicios en `src/services/` y rutas en `app/api/**/route.ts` con `export const runtime = "nodejs"`.
- **Validación:** `npm run check` (`tsc --noEmit`, `eslint . --max-warnings 0`, `prettier --check .`, `vitest run --coverage` > 85 %).
- **Decisión:** Aceptado tras aplicar las 3 correcciones documentadas abajo.

---

## Casos en que se Rechazó o Corrigió lo Propuesto por la IA (≥ 3 obligatorios)

### Corrección 1 — Diferenciación de mensajes en `/api/auth/login` (Riesgo de enumeración de usuarios)
- **Propuesta inicial de la IA:** Devolver `404 "El correo no está registrado"` cuando Firebase Auth respondía `EMAIL_NOT_FOUND` y `401 "Contraseña incorrecta"` cuando respondía `INVALID_PASSWORD`.
- **Motivo del rechazo:** La sección 9.1 de `09-memoria-juego.md` exige explícitamente: *"credenciales inválidas → 401 con el **mismo mensaje** exista o no el correo"*, para evitar la enumeración de cuentas.
- **Corrección aplicada:** Se unificó el mapeo en `src/services/auth.service.ts` para que `EMAIL_NOT_FOUND`, `INVALID_PASSWORD` e `INVALID_LOGIN_CREDENTIALS` devuelvan exactamente `401 { "error": "Credenciales inválidas" }`.

### Corrección 2 — Confianza en `user_id` enviado en el cuerpo del `POST /api/puntajes`
- **Propuesta inicial de la IA:** Aceptar un campo opcional `user_id` dentro del body JSON del `POST /api/puntajes` para asociar el puntaje al jugador.
- **Motivo del rechazo:** Viola la regla 9.1 y 9.5: *"El `uid` sale **del token verificado**, nunca del cuerpo ni de la URL"*. Permitir `user_id` en el body permitiría suplantar a otros usuarios.
- **Corrección aplicada:** Se usó `.strict()` en el esquema Zod sin `user_id` en la entrada del cliente; el `uid` se obtiene exclusivamente de `verificarToken(request)` (`getAuth().verifyIdToken()`).

### Corrección 3 — Uso de `.env.example` en lugar de `env.example`
- **Propuesta inicial de la IA:** Crear el archivo de plantilla como `.env.example`.
- **Motivo del rechazo:** La hoja de *Configuración de IA* (sección 2) advierte explícitamente: *"Publique un `env.example` con valores falsos (**no** `.env.example`: la regla `Read(**/.env*)` también lo bloquearía)"*.
- **Corrección aplicada:** Se renombró a `env.example` en la raíz del repositorio y se verificó que la regla `Read(**/.env*)` bloquee `.env` y `.env.local` pero permita consultar `env.example`.
