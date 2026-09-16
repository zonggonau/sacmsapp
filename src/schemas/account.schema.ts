import { z } from "zod";

/**
 * Hapus akun sendiri — docs/12 §12.6.
 *
 * Dua konfirmasi ketik-untuk-yakin: email akun dan kalimat baku. Isinya
 * dicocokkan ulang di service, bukan hanya di sini.
 */
export const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().min(1, "Ketik email akun Anda untuk konfirmasi"),
  confirmPhrase: z.string().trim().min(1, "Ketik kalimat konfirmasi"),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
