# 09 · Juego de Memoria con Puntajes — API (`09-memoria-juego-api`)

Backend REST construido con **Next.js (App Router, Route Handlers en runtime Node.js)**, **TypeScript (`strict`, `noUncheckedIndexedAccess`)**, **Firebase Admin SDK** y **Zod**, diseñado para desplegarse en **Vercel** y servir a la aplicación móvil `09-memoria-juego-app`.

---

## 1. Arquitectura y Seguridad

```text
[ App móvil (Expo) ]
   │  HTTPS + Authorization: Bearer <ID_TOKEN>
   ▼
[ API en Vercel (Next.js Route Handlers, runtime = "nodejs") ]
   ├── Validación de esquemas y plausibilidad con Zod (.strict())
   ├── Autenticación mediada con Firebase Auth REST API (FIREBASE_WEB_API_KEY)
   ├── Verificación de ID Token y custom claims con Firebase Admin Auth
   └── Acceso exclusivo a Firestore mediante Firebase Admin SDK
```

- **Regla de oro:** La app móvil no incluye `firebaseConfig` ni ninguna credencial. Todas las claves (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY`) viven **únicamente en Vercel**.
- **Reglas de Firestore (`firestore.rules`):** Niegan todo acceso directo desde clientes (`allow read, write: if false;`).
- **Aislamiento por ruta:** Los puntajes sincronizados de cada usuario viven en `usuarios/{uid}/puntajes/{id}`, donde `uid` se obtiene siempre de `getAuth().verifyIdToken()`, nunca del cuerpo ni de la URL.

---

## 2. Endpoints Implementados

| Método y Ruta | Autenticación | Descripción |
|---|---|---|
| `GET /api/health` | Pública | Verificación de estado del servicio (`200 { ok: true, servidor_ahora }`). |
| `POST /api/auth/registro` | Pública | Registro mediado en Firebase Auth (`contraseña ≥ 8`). Devuelve `201`. |
| `POST /api/auth/login` | Pública | Inicio de sesión mediado con límite de tasa (`429`) y mensaje uniforme en `401`. |
| `POST /api/auth/refresh` | Pública | Renovación de ID token mediante `refreshToken`. |
| `GET /api/auth/yo` | Bearer Token | Devuelve el perfil verificado (`{ id, email, rol }`). |
| `GET /api/ranking?dificultad=medio&ciudad=` | Bearer Token | Top 10 ordenado por `movimientos ASC` y `segundos ASC`. |
| `POST /api/puntajes` | Bearer Token | Valida plausibilidad (`≥ 1 s` y `≥ 1 movimiento` por pareja) y límite por minuto. |
| `GET /api/puntajes?since=<ISO>` | Bearer Token | Sincronización incremental de `usuarios/{uid}/puntajes` (incluye borrados lógicos). |
| `PUT /api/puntajes/<id>` | Bearer Token | Creación o reemplazo idempotente con `UUID` generado por el cliente. |
| `DELETE /api/puntajes/<id>` | Bearer Token | Borrado lógico (`deleted_at`). Devuelve `404` si no pertenece al usuario. |
| `DELETE /api/admin/puntajes/<id>` | Bearer + `rol="admin"` | Eliminación administrativa en el ranking global (`403` si no tiene el claim `admin`). |

---

## 3. Puesta en Marcha y Comandos de Calidad

```bash
# Instalar dependencias
npm install

# Ejecutar pruebas del Hook PreToolUse de contención de IA (10 pruebas)
npm run test:hook

# Ejecutar verificación integral de calidad (typecheck + lint + format:check + vitest coverage >= 80%)
npm run check

# Iniciar servidor de desarrollo
npm run dev
```

---

## 4. Justificación de Dependencias (`package.json`)

| Paquete | Tipo | Justificación |
|---|---|---|
| `next`, `react`, `react-dom` | Producción | Framework base exigido para Route Handlers (`app/api/**/route.ts`) en Vercel. |
| `firebase-admin` | Producción | SDK oficial de servidor para verificar ID tokens (`verifyIdToken`) y operar Firestore con reglas cerradas. |
| `zod` | Producción | Validación declarativa y estricta (`.strict()`) de todos los cuerpos y parámetros de consulta. |
| `typescript`, `@types/*` | Desarrollo | Tipado estático con `strict: true` y `noUncheckedIndexedAccess: true`. |
| `eslint`, `@typescript-eslint/*` | Desarrollo | Linter con límites de complejidad (`≤ 10`), líneas por función (`≤ 50`), profundidad (`≤ 3`) y `no-console`. |
| `prettier` | Desarrollo | Formateo automático consistente verificado en `npm run check`. |
| `vitest`, `@vitest/coverage-v8` | Desarrollo | Ejecución de pruebas unitarias y de integración con umbral obligatorio de cobertura `≥ 80 %`. |
| `husky`, `lint-staged` | Desarrollo | Hooks de Git (`pre-commit` y `pre-push`) para impedir commits o pushes que incumplan las reglas de calidad. |

---

## 5. Configuración de IA

Consulte [`IA.md`](./IA.md), [`AGENTS.md`](./AGENTS.md) y la carpeta [`ia/`](./ia/) para revisar la arquitectura de contención, el hook `PreToolUse`, las 10 pruebas con canario, el informe de inyección y la bitácora del equipo.
