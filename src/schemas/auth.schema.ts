import { z } from "zod";

export const registroSchema = z
  .object({
    email: z
      .string({ required_error: "El correo es obligatorio" })
      .trim()
      .toLowerCase()
      .email("Formato de correo inválido"),
    password: z
      .string({ required_error: "La contraseña es obligatoria" })
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(128, "La contraseña no puede superar 128 caracteres")
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string({ required_error: "El correo es obligatorio" })
      .trim()
      .toLowerCase()
      .email("Formato de correo inválido"),
    password: z
      .string({ required_error: "La contraseña es obligatoria" })
      .min(1, "La contraseña es obligatoria")
      .max(128, "La contraseña no puede superar 128 caracteres")
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z
      .string({ required_error: "El refreshToken es obligatorio" })
      .trim()
      .min(10, "El refreshToken es inválido")
  })
  .strict();

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
