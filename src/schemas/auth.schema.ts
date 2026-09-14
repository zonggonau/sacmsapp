import { z } from "zod";

/**
 * Skema validasi autentikasi — dipakai bersama oleh klien dan server.
 * Satu sumber, supaya pesan error tidak pernah berbeda antara keduanya.
 */

const email = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .email("Format email tidak valid")
  .toLowerCase();

const password = z
  .string()
  .min(10, "Kata sandi minimal 10 karakter")
  .max(128, "Kata sandi terlalu panjang");

const name = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter")
  .max(80, "Nama maksimal 80 karakter");

export const signUpSchema = z.object({
  name,
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Kata sandi wajib diisi"),
  lanjut: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token tidak valid"),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export const resendVerificationSchema = z.object({ email });

export const updateProfileSchema = z.object({ name });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
