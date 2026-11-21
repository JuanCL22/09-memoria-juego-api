import { z } from "zod";

export const dificultades = ["facil", "medio", "dificil"] as const;
export type Dificultad = (typeof dificultades)[number];

export const PAREJAS_POR_DIFICULTAD: Record<Dificultad, number> = {
  facil: 4,
  medio: 6,
  dificil: 12
};

export const uuidSchema = z.string().uuid("El identificador debe ser un UUID válido");

export const dificultadSchema = z.enum(dificultades, {
  errorMap: () => ({
    message: "La dificultad debe ser 'facil', 'medio' o 'dificil'"
  })
});

const camposBasePuntaje = {
  id: uuidSchema.optional(),
  jugador: z
    .string({ required_error: "El nombre del jugador es obligatorio" })
    .trim()
    .min(2, "El nombre del jugador debe tener entre 2 y 15 caracteres")
    .max(15, "El nombre del jugador debe tener entre 2 y 15 caracteres"),
  dificultad: dificultadSchema,
  movimientos: z
    .number({ required_error: "Los movimientos son obligatorios" })
    .int("Los movimientos deben ser un número entero")
    .positive("Los movimientos deben ser mayores a 0")
    .max(10000, "Número de movimientos no plausible"),
  segundos: z
    .number({ required_error: "Los segundos son obligatorios" })
    .int("Los segundos deben ser un número entero")
    .positive("Los segundos deben ser mayores a 0")
    .max(86400, "Tiempo de partida no plausible"),
  ciudad: z
    .string()
    .trim()
    .min(2, "La ciudad debe tener al menos 2 caracteres")
    .max(60, "La ciudad no puede exceder 60 caracteres")
    .nullable()
    .optional(),
  jugado_en: z
    .string()
    .datetime({ message: "jugado_en debe estar en formato ISO 8601 UTC" })
    .optional()
};

export const puntajeInputSchema = z
  .object(camposBasePuntaje)
  .strict()
  .superRefine((datos, ctx) => {
    const parejas = PAREJAS_POR_DIFICULTAD[datos.dificultad];
    if (datos.movimientos < parejas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["movimientos"],
        message: `Para dificultad '${datos.dificultad}' se requieren al menos ${parejas} movimientos`
      });
    }
    if (datos.segundos < parejas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segundos"],
        message: `Tiempo no plausible: se requiere mínimo 1 s por pareja (${parejas} s para '${datos.dificultad}')`
      });
    }
  });

export const rankingQuerySchema = z
  .object({
    dificultad: dificultadSchema.default("medio"),
    ciudad: z
      .string()
      .trim()
      .transform((val) => (val === "" ? null : val))
      .nullable()
      .default(null)
  })
  .strict();

export const sinceQuerySchema = z
  .object({
    since: z
      .string()
      .datetime({ message: "El parámetro since debe ser una fecha ISO 8601 UTC válida" })
      .optional()
  })
  .strict();

export type PuntajeInput = z.infer<typeof puntajeInputSchema>;
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
