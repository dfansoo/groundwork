import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(60, "Name is too long")
    .regex(/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/, "Use letters, spaces, hyphens and apostrophes only"),
  email: z.string().trim().pipe(z.email("Enter a valid email")),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email")),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
  // The API rejects this too; catching it here saves a round trip and gives the
  // message a field to attach to.
  .refine((d) => d.password !== d.currentPassword, {
    message: "Choose a password different from your current one",
    path: ["password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
