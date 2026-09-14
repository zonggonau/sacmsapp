/**
 * WAJIB ADA.
 *
 * Tanpa berkas ini, me-refresh halaman saat dialog terbuka membuat slot @modal
 * tidak punya keadaan baku dan Next.js membalas 404. docs/05 §5.5
 */
export default function ModalDefault() {
  return null;
}
