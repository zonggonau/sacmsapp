/**
 * Menjembatani `<form action>` dengan `execute()` milik next-safe-action.
 *
 * `useAction().execute` menerima objek input bertipe, sedangkan atribut
 * `action` pada <form> menyerahkan FormData. Helper ini menjembatani keduanya
 * sehingga formulir tetap ditulis sebagai <form action={...}> — bentuk yang
 * bekerja bahkan sebelum JavaScript termuat.
 *
 * Ini adalah SATU-SATUNYA tempat di basis kode yang menegaskan tipe pada input
 * formulir. Penegasan di sini aman karena tidak ada keputusan yang diambil
 * berdasarkan tipe tersebut di klien: validasi sebenarnya terjadi di server
 * lewat `.inputSchema()`, dan input yang tidak sesuai ditolak di sana.
 *
 * docs/08-SERVER-ACTIONS.md §8.5
 */
export function formAction<TInput>(execute: (input: TInput) => void) {
  return (formData: FormData) => {
    execute(Object.fromEntries(formData.entries()) as TInput);
  };
}
