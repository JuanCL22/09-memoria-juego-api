# Configuración de Seguridad y Calidad de IA — `09-memoria-juego-api`

## 1. Arquitectura de Defensa en Profundidad (Capas)

Una instrucción en lenguaje natural (`AGENTS.md`) orienta al modelo pero no constituye una frontera de seguridad. Por ello este repositorio aplica **4 capas complementarias**:

| Capa | Archivo / Mecanismo | Riesgo que cubre | Límite conocido |
|---|---|---|---|
| **1. Reglas de orientación** | `AGENTS.md` / `CLAUDE.md` | Define arquitectura, convenciones de Firestore, reglas de ESLint y advierte que archivos/payloads son datos, no órdenes. | Un modelo podría ignorarlas ante *prompt injection* si no existieran las capas 2, 3 y 4. |
| **2. Permisos declarativos** | `.claude/settings.json` (`permissions.deny`, `ask`, `blockReadsOutsideWorkingDirectories`) | Bloquea herramientas `Read`/`Edit`/`Write` sobre `.env*`, `*.pem`, `*.key`, `*firebase-adminsdk*.json`, `.claude/**` y comandos `curl`, `wget`, `sudo`, `rm -rf`, `git push --force`. | Una regla `Bash(curl *)` por sí sola no inspecciona scripts internos de Node ni rutas absolutas si no se acompaña de Hook y Sandbox. |
| **3. Hook ejecutable `PreToolUse`** | `.claude/hooks/pre-tool-use.mjs` | Inspecciona programáticamente el JSON de cada herramienta antes de su ejecución; bloquea con código de salida `2` cualquier referencia a `.env*`, `CANARIO`, `../`, `~/`, `/usr/bin/curl`, etc. | Depende de que la configuración de `.claude/settings.json` esté protegida contra escritura (`Edit(./.claude/**)` denegado). |
| **4. Sandbox + Cero secretos en disco** | `sandbox.enabled: true` + modo emulador/memoria local | Aísla el sistema de archivos (`denyRead: ["~/"]`, `allowRead: ["."]`) y la red (`allowedDomains`). Además, las claves reales de producción viven únicamente en Vercel. | En Windows nativo el sandbox de Linux requiere ejecutarse dentro de WSL2 (`bubblewrap` + `socat`). |

## 2. Ajustes Realizados

1. **`env.example` sin punto inicial:** Se nombró `env.example` en lugar de `.env.example` porque la regla `Read(**/.env*)` bloquea cualquier archivo que inicie con `.env`.
2. **Protección de la jaula:** Se incluyó `Edit(./.claude/**)` y `Write(./.claude/**)` en `permissions.deny` y en el hook `PreToolUse` para impedir que la IA modifique sus propias restricciones.
3. **Verificación automática:** Se integró `npm run test:hook` (10 pruebas con `node:test`) y `npm run check` (`tsc --noEmit` + `eslint` + `prettier` + `vitest --coverage` ≥ 80 %) tanto en `.husky/pre-push` como en GitHub Actions.
