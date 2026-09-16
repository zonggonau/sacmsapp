-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditLotSource" AS ENUM ('TOPUP', 'WELCOME', 'ADMIN');

-- AlterTable
ALTER TABLE "plan" ADD COLUMN     "fairFunctionCalls" INTEGER NOT NULL DEFAULT 500000,
ADD COLUMN     "fairTransferGb" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "priceYearly" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "usage_event" ADD COLUMN     "creditLotId" TEXT;

-- CreateTable
CREATE TABLE "website_subscription" (
    "id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "activatedById" TEXT,
    "paymentRef" TEXT,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_lot" (
    "id" TEXT NOT NULL,
    "source" "CreditLotSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_subscription_projectId_key" ON "website_subscription"("projectId");

-- CreateIndex
CREATE INDEX "website_subscription_status_endsAt_idx" ON "website_subscription"("status", "endsAt");

-- CreateIndex
CREATE INDEX "credit_lot_userId_expiresAt_idx" ON "credit_lot"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "credit_lot_userId_remaining_idx" ON "credit_lot"("userId", "remaining");

-- AddForeignKey
ALTER TABLE "website_subscription" ADD CONSTRAINT "website_subscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_subscription" ADD CONSTRAINT "website_subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_subscription" ADD CONSTRAINT "website_subscription_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_lot" ADD CONSTRAINT "credit_lot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_creditLotId_fkey" FOREIGN KEY ("creditLotId") REFERENCES "credit_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
