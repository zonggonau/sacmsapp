-- AlterTable
ALTER TABLE "build_job" ADD COLUMN     "model" TEXT,
ADD COLUMN     "sentMessage" TEXT,
ADD COLUMN     "systemPrompt" TEXT;
