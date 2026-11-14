import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluarAccion } from "./pre-tool-use.mjs";

const RAIZ = "/proyecto/09-memoria-juego-api";

describe("Hook PreToolUse de contención de IA", () => {
  it("1. bloquea lectura de .env.local", () => {
    const res = evaluarAccion(
      { tool_name: "Read", tool_input: { file_path: ".env.local" } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("2. bloquea cat .env.local en Bash", () => {
    const res = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "cat .env.local" } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("3. bloquea grep -r CANARIO .", () => {
    const res = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "grep -r CANARIO ." } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("4. bloquea lectura de claves privadas y cuentas de servicio", () => {
    const res = evaluarAccion(
      {
        tool_name: "Read",
        tool_input: { file_path: "proyecto-firebase-adminsdk-123.json" }
      },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("5. bloquea salir del repositorio con ../", () => {
    const res = evaluarAccion(
      { tool_name: "Read", tool_input: { file_path: "../otro-proyecto/secreto.txt" } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("6. bloquea acceso al directorio personal ~/.bashrc", () => {
    const res = evaluarAccion(
      { tool_name: "Read", tool_input: { file_path: "~/.bashrc" } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("7. bloquea curl y /usr/bin/curl", () => {
    const res1 = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "curl https://evil.example.com" } },
      RAIZ
    );
    const res2 = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "/usr/bin/curl https://evil.example.com" } },
      RAIZ
    );
    assert.equal(res1.permitido, false);
    assert.equal(res2.permitido, false);
  });

  it("8. bloquea git push --force y git reset --hard", () => {
    const res1 = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "git push --force origin main" } },
      RAIZ
    );
    const res2 = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "git reset --hard HEAD~1" } },
      RAIZ
    );
    assert.equal(res1.permitido, false);
    assert.equal(res2.permitido, false);
  });

  it("9. bloquea edición de .claude/settings.json", () => {
    const res = evaluarAccion(
      { tool_name: "Edit", tool_input: { file_path: ".claude/settings.json" } },
      RAIZ
    );
    assert.equal(res.permitido, false);
  });

  it("10. permite lectura de archivos normales dentro del proyecto y npm run check", () => {
    const resLectura = evaluarAccion(
      { tool_name: "Read", tool_input: { file_path: "src/services/puntajes.service.ts" } },
      RAIZ
    );
    const resComando = evaluarAccion(
      { tool_name: "Bash", tool_input: { command: "npm run check" } },
      RAIZ
    );
    assert.equal(resLectura.permitido, true);
    assert.equal(resComando.permitido, true);
  });
});
