/**
 * Instruksi rekaman DNS untuk custom domain — docs/09-AI-BUILDER-PIPELINE.md §9.10.
 *
 * KENAPA BERKAS INI ADA: versi sebelumnya selalu memberi instruksi `A @` dan
 * `CNAME www`, termasuk untuk subdomain. Untuk `dinaskominfo.intanjayakab.go.id`,
 * instruksi `A @` diterapkan pada zona `intanjayakab.go.id` dan akan MEMBELOKKAN
 * SELURUH SITUS INDUK — situs resmi kabupaten — ke Vercel. Instruksi DNS yang
 * salah bukan sekadar tidak berfungsi; ia merusak milik orang lain.
 *
 * Aturannya:
 * - domain utama (apex)  -> A @ <IPv4 anjuran Vercel>
 * - subdomain            -> CNAME <label> <CNAME anjuran Vercel>
 * - tantangan verifikasi dari Vercel (TXT) selalu ditambahkan apa adanya
 *
 * Berkas murni (tanpa I/O) agar bisa dipakai di server maupun diuji langsung.
 */

export interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  /** Nama host RELATIF terhadap zona domain utama, seperti yang diketik di panel DNS. */
  name: string;
  value: string;
  /** Penjelasan singkat untuk pengguna awam. */
  purpose: string;
}

/** Cadangan bila anjuran Vercel tidak bisa diambil. Keduanya masih diterima Vercel. */
export const VERCEL_APEX_IPV4 = "76.76.21.21";
export const VERCEL_CNAME = "cname.vercel-dns.com";

/**
 * Akhiran bertingkat yang umum. Domain di bawahnya punya tiga label sebagai
 * domain utama (mis. `intanjayakab.go.id`, bukan `go.id`).
 *
 * Ini daftar terkurasi, BUKAN Public Suffix List lengkap. Cakupannya dipilih untuk
 * pengguna Indonesia; akhiran di luar daftar diperlakukan sebagai akhiran satu
 * label. Tambahkan di sini bila pengguna melaporkan instruksi yang keliru.
 */
const MULTI_LEVEL_SUFFIXES = new Set([
  // Indonesia (PANDI)
  "go.id",
  "co.id",
  "ac.id",
  "sch.id",
  "or.id",
  "web.id",
  "my.id",
  "biz.id",
  "net.id",
  "mil.id",
  "desa.id",
  "ponpes.id",
  // Umum di luar negeri
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "com.sg",
  "com.my",
  "co.jp",
  "co.nz",
  "com.br",
]);

export interface DomainParts {
  /** Domain utama tempat zona DNS dikelola, mis. `intanjayakab.go.id`. */
  apex: string;
  /** Label di depan domain utama, mis. `dinaskominfo`; null bila apex. */
  subdomain: string | null;
}

/**
 * @param apexHint domain utama menurut Vercel (`apexName`, berbasis Public Suffix
 *                 List lengkap). Bila ada, ia MENANG atas daftar terkurasi di atas.
 */
export function splitDomain(domain: string, apexHint?: string | null): DomainParts {
  const labels = domain
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean);
  const full = labels.join(".");

  const hint = apexHint?.trim().toLowerCase().replace(/\.$/, "");
  if (hint && (full === hint || full.endsWith(`.${hint}`))) {
    return full === hint
      ? { apex: hint, subdomain: null }
      : { apex: hint, subdomain: full.slice(0, -(hint.length + 1)) };
  }

  const lastTwo = labels.slice(-2).join(".");
  const apexLabelCount = MULTI_LEVEL_SUFFIXES.has(lastTwo) ? 3 : 2;

  if (labels.length <= apexLabelCount) {
    return { apex: labels.join("."), subdomain: null };
  }

  return {
    apex: labels.slice(-apexLabelCount).join("."),
    subdomain: labels.slice(0, -apexLabelCount).join("."),
  };
}

export interface VerificationChallenge {
  type: string;
  domain: string;
  value: string;
}

export interface RecordOptions {
  apexHint?: string | null | undefined;
  challenges?: VerificationChallenge[] | undefined;
  ipv4?: string | null | undefined;
  cname?: string | null | undefined;
}

export function recordsFor(domain: string, options: RecordOptions = {}): DnsRecord[] {
  const { apex, subdomain } = splitDomain(domain, options.apexHint);
  const challenges = options.challenges ?? [];

  const records: DnsRecord[] = subdomain
    ? [
        {
          type: "CNAME",
          name: subdomain,
          value: options.cname || VERCEL_CNAME,
          purpose: `Mengarahkan ${domain} ke website Anda. Jangan ubah rekaman @ milik ${apex}.`,
        },
      ]
    : [
        {
          type: "A",
          name: "@",
          value: options.ipv4 || VERCEL_APEX_IPV4,
          purpose: `Mengarahkan ${domain} ke website Anda.`,
        },
      ];

  for (const c of challenges) {
    if (c.type.toUpperCase() !== "TXT") continue;

    // Vercel memberi nama lengkap (mis. `_vercel.intanjayakab.go.id`); panel DNS
    // umumnya meminta nama relatif terhadap zona.
    const full = c.domain.toLowerCase().replace(/\.$/, "");
    const relative =
      full === apex
        ? "@"
        : full.endsWith(`.${apex}`)
          ? full.slice(0, -(apex.length + 1))
          : full;

    records.push({
      type: "TXT",
      name: relative,
      value: c.value,
      purpose:
        "Membuktikan domain ini milik Anda. Wajib ditambahkan sebelum domain bisa aktif.",
    });
  }

  return records;
}

/** Type guard untuk kolom JSON `domain.dnsRecords` yang dibaca dari database. */
export function parseDnsRecords(value: unknown): DnsRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is DnsRecord =>
      typeof r === "object" &&
      r !== null &&
      ["A", "CNAME", "TXT"].includes((r as DnsRecord).type) &&
      typeof (r as DnsRecord).name === "string" &&
      typeof (r as DnsRecord).value === "string" &&
      typeof (r as DnsRecord).purpose === "string",
  );
}
