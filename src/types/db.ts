/**
 * Re-export tipe dan enum hasil generate Prisma.
 *
 * Aturan arsitektur (docs/02 §2.2) melarang mengimpor client hasil generate di
 * luar `lib/db.ts`. Yang dilarang adalah **client**-nya — objek yang membuka
 * koneksi. Tipe dan enum tidak membawa runtime apa pun.
 *
 * Berkas ini adalah satu-satunya pintu untuk tipe tersebut, sehingga bila
 * lokasi hasil generate berpindah, yang berubah hanya dua berkas: ini dan
 * `lib/db.ts`.
 */
export type {
  BuildJobKind,
  BuildJobStatus,
  BuildStepStatus,
  DeploymentStatus,
  DeploymentTarget,
  DomainStatus,
  MessageRole,
  ProjectStatus,
  UsageKind,
  UsageState,
  UserRole,
  UserStatus,
  WebsiteType,
} from "@/generated/prisma/enums";
