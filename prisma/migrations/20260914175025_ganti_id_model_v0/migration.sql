-- AlterTable
ALTER TABLE "plan" ALTER COLUMN "allowedModels" SET DEFAULT ARRAY['v0-mini']::TEXT[];

-- Perbaikan data. Id model `v0-1.5-*` tidak pernah ada di v0 API (diverifikasi
-- dari tipe ChatsCreateRequest di v0-sdk 0.16.7), sehingga semua paket jatuh ke
-- model default dan pembatasan model per paket tidak berfungsi.
-- Aman menimpa tiga paket baku: belum ada UI admin untuk mengubahnya (Fase 5).
UPDATE "plan" SET "allowedModels" = ARRAY['v0-mini']::TEXT[] WHERE "slug" = 'free';
UPDATE "plan" SET "allowedModels" = ARRAY['v0-mini','v0-auto','v0-pro']::TEXT[] WHERE "slug" = 'pro';
UPDATE "plan" SET "allowedModels" = ARRAY['v0-mini','v0-auto','v0-pro','v0-max','v0-max-fast']::TEXT[] WHERE "slug" = 'business';

-- Paket lain yang sama sekali tidak memuat id valid
UPDATE "plan" SET "allowedModels" = ARRAY['v0-mini']::TEXT[]
WHERE NOT ("allowedModels" && ARRAY['v0-mini','v0-auto','v0-pro','v0-max','v0-max-fast']::TEXT[]);

-- Model default sistem hanya diganti bila masih bernilai lama
UPDATE "system_setting" SET "value" = '"v0-mini"'::jsonb
WHERE "key" = 'ai.defaultModel' AND "value" = '"v0-1.5-sm"'::jsonb;
