# 06 — Database Schema

**PostgreSQL 16 (Neon) + Prisma 7.10.0**

## 6.1 Peta Relasi

```
                            Plan
                              | 1
                              |
                              v *
   AuditLog *----1  User  1----* Project  1----* ProjectVersion
                     | 1            | 1
                     |              +----* AiMessage
                     |              | 1
                     +----* Session +----* BuildJob  1----* BuildStep
                     |              | 1
                     +----* Account +----* Deployment
                     |              | 1
                     +----* UsageEvent  +----* Domain
                     |
                     +----* Notification

                     SystemSetting   (tabel tunggal, key-value, milik Super Admin)
                     Verification    (token email, milik Better Auth)
```

Satu `User` memiliki banyak `Project`. Tidak ada `Workspace` di MVP — lihat
[ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md) beserta jalur migrasinya.

## 6.2 Aturan Skema yang Mengikat

1. **Primary key**: `cuid()` untuk semua tabel. Bukan auto-increment (bocor jumlah data),
   bukan UUIDv4 acak (buruk untuk indeks B-tree).
2. **Waktu**: setiap tabel punya `createdAt` dan `updatedAt` (`@updatedAt`). Semua UTC.
3. **Uang & kredit**: `Int`, satuan terkecil (rupiah utuh; kredit utuh). **Tidak ada
   `Float` untuk nilai yang dihitung.**
4. **Penghapusan**: data milik user memakai **soft delete** (`deletedAt`). Hanya Super
   Admin yang bisa hard delete, dan itu tercatat di audit.
5. **`onDelete: Cascade`** dipakai hanya untuk anak yang benar-benar tidak berarti tanpa
   induknya (`BuildStep` dari `BuildJob`). `AuditLog` dan `UsageEvent` memakai
   `onDelete: SetNull` — catatan harus bertahan meski user dihapus.
6. **Indeks**: setiap kolom yang muncul di `where` atau `orderBy` pada jalur panas wajib
   punya indeks. Daftar di §6.5.
7. **Enum** didefinisikan di Prisma (bukan string bebas) supaya salah ketik tertangkap
   saat kompilasi.
8. **Rahasia pihak ketiga** (`v0ChatId`, `vercelProjectId`) adalah pengenal, bukan
   kredensial — boleh disimpan polos. Token API **tidak pernah** disimpan per-project.

## 6.3 `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
//  ENUM
// ============================================================

enum UserRole {
  USER          // pengguna biasa
  ADMIN         // staf pendukung: baca + tindakan terbatas
  SUPER_ADMIN   // pemilik sistem: kendali penuh
}

enum UserStatus {
  ACTIVE
  SUSPENDED     // diblokir Super Admin, tidak bisa masuk
  DELETED       // soft delete
}

enum ProjectStatus {
  DRAFT         // dibuat, belum pernah dibangun
  BUILDING      // ada job berjalan
  READY         // ada preview, belum terbit
  LIVE          // sudah terbit ke production
  FAILED        // build terakhir gagal
  ARCHIVED
}

enum WebsiteType {
  GOVERNMENT  COMPANY   ECOMMERCE  SCHOOL   HOSPITAL
  HOTEL       RESTAURANT PORTFOLIO SAAS     LANDING
  BLOG        CUSTOM
}

enum BuildJobStatus {
  QUEUED  RUNNING  SUCCEEDED  FAILED  CANCELLED
}

enum BuildJobKind {
  INITIAL_GENERATE   // pembuatan pertama
  EDIT_GENERATE      // perubahan lewat prompt
  DEPLOY             // terbit saja, tanpa generate
}

enum BuildStepStatus {
  PENDING  RUNNING  DONE  FAILED  SKIPPED
}

enum DeploymentStatus {
  QUEUED  BUILDING  READY  ERROR  CANCELLED
}

enum DeploymentTarget {
  PREVIEW  PRODUCTION
}

enum DomainStatus {
  PENDING_DNS  VERIFYING  ACTIVE  FAILED
}

enum MessageRole {
  USER  ASSISTANT  SYSTEM
}

enum UsageKind {
  AI_GENERATE  AI_EDIT  DEPLOY  PROJECT_CREATE
}

enum UsageState {
  RESERVED   // dipotong di muka, sebelum kerja dimulai
  COMMITTED  // kerja berhasil
  REFUNDED   // kerja gagal, kredit dikembalikan
}

// ============================================================
//  AUTENTIKASI  (bentuk mengikuti Better Auth)
//  Verifikasi nama kolom terhadap skema Better Auth 1.7.x saat scaffold.
// ============================================================

model User {
  id            String     @id @default(cuid())
  name          String
  email         String     @unique
  emailVerified Boolean    @default(false)
  image         String?

  // --- kolom SaCMS ---
  role          UserRole   @default(USER)
  status        UserStatus @default(ACTIVE)

  planId        String
  plan          Plan       @relation(fields: [planId], references: [id])
  planExpiresAt DateTime?

  // Kuota disimpan di user agar Super Admin bisa menaikkan per-orang
  // tanpa mengubah plan. null = pakai nilai dari Plan.
  creditsOverride    Int?
  maxProjectsOverride Int?

  creditsUsed      Int      @default(0)   // terpakai pada periode berjalan
  periodStartedAt  DateTime @default(now())

  // --- plugin admin Better Auth ---
  banned      Boolean?
  banReason   String?
  banExpires  DateTime?

  lastLoginAt DateTime?
  deletedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions      Session[]
  accounts      Account[]
  projects      Project[]
  usageEvents   UsageEvent[]
  auditLogs     AuditLog[]     @relation("AuditActor")
  notifications Notification[]

  @@index([role])
  @@index([status])
  @@index([planId])
  @@index([createdAt])
  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // jejak impersonasi Super Admin - wajib untuk audit
  impersonatedBy String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([expiresAt])
  @@map("session")
}

model Account {
  id         String  @id @default(cuid())
  accountId  String
  providerId String

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?   // hash argon2/scrypt untuk login email

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerId, accountId])
  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

// ============================================================
//  PAKET & KUOTA
// ============================================================

model Plan {
  id       String  @id @default(cuid())
  slug     String  @unique      // "free" | "pro" | "business"
  name     String
  description String?

  priceMonthly Int  @default(0) // rupiah utuh
  isPublic     Boolean @default(true)
  sortOrder    Int     @default(0)

  // Batas - diubah Super Admin lewat UI, tanpa deploy ulang
  maxProjects       Int  @default(1)
  monthlyCredits    Int  @default(30)
  maxCustomDomains  Int  @default(0)
  maxDeploysPerDay  Int  @default(3)
  allowedModels     String[] @default(["v0-mini"])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]

  @@map("plan")
}

// ============================================================
//  PROJECT
// ============================================================

model Project {
  id          String        @id @default(cuid())
  name        String
  slug        String
  description String?

  websiteType WebsiteType   @default(CUSTOM)
  status      ProjectStatus @default(DRAFT)

  initialPrompt String       @db.Text   // prompt asli user, disimpan apa adanya

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // --- pengenal pihak ketiga ---
  v0ProjectId     String?
  v0ChatId        String?  @unique
  vercelProjectId String?

  previewUrl    String?
  productionUrl String?

  currentVersionId String? @unique
  currentVersion   ProjectVersion? @relation("CurrentVersion",
                      fields: [currentVersionId], references: [id])

  lastBuildAt  DateTime?
  lastDeployAt DateTime?
  deletedAt    DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  versions    ProjectVersion[] @relation("ProjectVersions")
  messages    AiMessage[]
  buildJobs   BuildJob[]
  deployments Deployment[]
  domains     Domain[]

  @@unique([userId, slug])
  @@index([userId, status])
  @@index([userId, createdAt])
  @@index([status])
  @@index([deletedAt])
  @@map("project")
}

model ProjectVersion {
  id      String @id @default(cuid())
  number  Int                    // 1, 2, 3 ... per project

  projectId String
  project   Project @relation("ProjectVersions",
               fields: [projectId], references: [id], onDelete: Cascade)

  v0VersionId String?
  demoUrl     String?
  summary     String? @db.Text   // ringkasan perubahan, bahasa Indonesia

  createdAt DateTime @default(now())

  currentOf   Project?    @relation("CurrentVersion")
  deployments Deployment[]

  @@unique([projectId, number])
  @@index([projectId, createdAt])
  @@map("project_version")
}

model AiMessage {
  id   String      @id @default(cuid())
  role MessageRole

  content String @db.Text

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  buildJobId String?
  buildJob   BuildJob? @relation(fields: [buildJobId], references: [id])

  tokensIn  Int?
  tokensOut Int?

  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
  @@map("ai_message")
}

// ============================================================
//  PIPELINE BUILD
// ============================================================

model BuildJob {
  id     String         @id @default(cuid())
  kind   BuildJobKind
  status BuildJobStatus @default(QUEUED)

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  prompt String @db.Text

  progress Int @default(0)   // 0-100, untuk progress bar

  attempt    Int @default(0)
  maxAttempts Int @default(3)

  // Dilaporkan ke user - sudah diterjemahkan, bukan error mentah
  errorCode    String?
  errorMessage String?
  // Untuk Super Admin - boleh mentah
  rawError     String? @db.Text

  correlationId String  @unique   // penelusuran lintas layanan

  creditsCost Int @default(1)

  startedAt  DateTime?
  finishedAt DateTime?
  // Batas waktu; job melewati ini disapu cron menjadi FAILED
  timeoutAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  steps       BuildStep[]
  messages    AiMessage[]
  deployments Deployment[]
  usageEvents UsageEvent[]

  @@index([projectId, createdAt])
  @@index([status, createdAt])
  @@index([status, timeoutAt])
  @@map("build_job")
}

model BuildStep {
  id    String @id @default(cuid())
  key   String                  // "PLANNING" | "GENERATING" | ...
  label String                  // "Menyusun arsitektur" (bahasa Indonesia)
  order Int

  status BuildStepStatus @default(PENDING)

  buildJobId String
  buildJob   BuildJob @relation(fields: [buildJobId], references: [id], onDelete: Cascade)

  detail      String?
  startedAt   DateTime?
  finishedAt  DateTime?
  durationMs  Int?

  @@unique([buildJobId, key])
  @@index([buildJobId, order])
  @@map("build_step")
}

// ============================================================
//  DEPLOYMENT & DOMAIN
// ============================================================

model Deployment {
  id     String           @id @default(cuid())
  status DeploymentStatus @default(QUEUED)
  target DeploymentTarget @default(PREVIEW)

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  versionId String?
  version   ProjectVersion? @relation(fields: [versionId], references: [id])

  buildJobId String?
  buildJob   BuildJob? @relation(fields: [buildJobId], references: [id])

  vercelDeploymentId String? @unique
  url                String?

  errorMessage String?
  logUrl       String?

  // Siapa yang menerbitkan - penting saat Super Admin bertindak atas nama user
  triggeredById String?

  readyAt   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, createdAt])
  @@index([status])
  @@map("deployment")
}

model Domain {
  id     String       @id @default(cuid())
  name   String       @unique      // "dinaskominfo.go.id"
  status DomainStatus @default(PENDING_DNS)

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  verificationToken String?
  dnsRecords        Json?    // instruksi yang ditampilkan ke user
  lastCheckedAt     DateTime?
  errorMessage      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([status])
  @@map("domain")
}

// ============================================================
//  USAGE, AUDIT, SISTEM
// ============================================================

model UsageEvent {
  id    String     @id @default(cuid())
  kind  UsageKind
  state UsageState @default(RESERVED)

  credits Int

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  projectId  String?
  buildJobId String?
  buildJob   BuildJob? @relation(fields: [buildJobId], references: [id])

  // Biaya nyata dari vendor, diisi saat rekonsiliasi. Rupiah utuh.
  vendorCostIdr Int?
  model         String?

  metadata Json?

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([kind, createdAt])
  @@index([state])
  @@map("usage_event")
}

model AuditLog {
  id     String @id @default(cuid())
  action String              // "user.suspend", "plan.update", "system.killswitch.on"

  actorId String?
  actor   User?   @relation("AuditActor", fields: [actorId], references: [id],
                            onDelete: SetNull)
  actorRole UserRole?

  targetType String?         // "User" | "Project" | "Plan" | "SystemSetting"
  targetId   String?

  before Json?
  after  Json?

  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
  @@index([action, createdAt])
  @@index([createdAt])
  @@map("audit_log")
}

model SystemSetting {
  key         String   @id       // "ai.killSwitch", "system.maintenance"
  value       Json
  description String?
  updatedById String?
  updatedAt   DateTime @updatedAt

  @@map("system_setting")
}

model Notification {
  id    String  @id @default(cuid())
  type  String              // "build.succeeded" | "build.failed" | "quota.low"
  title String
  body  String?
  href  String?
  read  Boolean @default(false)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId, read, createdAt])
  @@map("notification")
}
```

## 6.4 Data Awal (`prisma/seed.ts`)

Seed **wajib idempoten** (`upsert`), karena dijalankan berulang di staging.

| Data                | Nilai                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Plan `free`         | 1 project, 30 kredit/bulan, 0 domain, 3 deploy/hari                                         |
| Plan `pro`          | 10 project, 500 kredit/bulan, 3 domain, 30 deploy/hari                                      |
| Plan `business`     | 50 project, 3.000 kredit/bulan, 25 domain, 200 deploy/hari                                  |
| Super Admin pertama | Dari `SEED_SUPERADMIN_EMAIL` + `SEED_SUPERADMIN_PASSWORD`                                   |
| `SystemSetting`     | `ai.killSwitch=false`, `system.maintenance=false`, `ai.defaultModel`, `signup.enabled=true` |

> **Aturan keamanan:** seed **menolak berjalan** di production jika
> `SEED_SUPERADMIN_PASSWORD` kosong atau kurang dari 16 karakter. Tidak ada kata sandi
> default yang di-hardcode di repositori — pernah menjadi penyebab kebocoran nyata di
> banyak proyek.

## 6.5 Indeks yang Membenarkan Dirinya

| Indeks                                  | Query yang dilayani                          |
| --------------------------------------- | -------------------------------------------- |
| `project(userId, status)`               | Daftar project difilter status di dashboard  |
| `project(userId, createdAt)`            | Daftar project urut terbaru                  |
| `build_job(status, createdAt)`          | Antrean admin, pengambilan pekerjaan         |
| `build_job(status, timeoutAt)`          | Cron penyapu job nyangkut                    |
| `build_step(buildJobId, order)`         | Render checklist progres                     |
| `ai_message(projectId, createdAt)`      | Riwayat chat builder                         |
| `usage_event(userId, createdAt)`        | Hitung kredit terpakai periode berjalan      |
| `audit_log(targetType, targetId)`       | "Apa saja yang pernah terjadi pada user ini" |
| `notification(userId, read, createdAt)` | Lonceng notifikasi                           |

## 6.6 Aturan Migrasi

1. Semua perubahan skema lewat `prisma migrate dev --name deskripsi-jelas`.
   **Tidak pernah** `db push` pada database bersama.
2. Migrasi **wajib** commit ke git bersama perubahan kodenya.
3. Kolom `NOT NULL` baru pada tabel berisi data wajib tiga langkah:
   tambah nullable → backfill → jadikan wajib. Tidak dalam satu rilis.
4. Rename kolom = tambah baru + salin + hapus lama di rilis berikutnya.
   Jangan rename langsung (memutus versi lama yang masih berjalan saat deploy bergulir).
5. Sebelum migrasi production: ambil branch Neon sebagai titik pulih.
6. Setiap migrasi diuji dulu di branch staging Neon dengan salinan data nyata.

## 6.7 Akses Data

```ts
// src/lib/db.ts
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

Aturan query yang mengikat:

```ts
// SALAH - mengambil dulu, memeriksa belakangan. Rawan lolos.
const project = await db.project.findUnique({ where: { id } });
if (project.userId !== user.id) throw new Error("Forbidden");

// BENAR - kepemilikan menjadi bagian dari query
const project = await db.project.findFirst({
  where: { id, userId: user.id, deletedAt: null },
});
if (!project) notFound();
```

- **Selalu** sertakan `deletedAt: null` pada query baca data user.
- **Selalu** pakai `select` eksplisit pada tabel yang punya kolom besar
  (`initialPrompt`, `rawError`) saat hanya butuh ringkasan.
- Mutasi yang menyentuh lebih dari satu tabel **wajib** `db.$transaction`.
- Pagination memakai **cursor**, bukan `skip`/`offset`, untuk daftar yang bisa panjang.
