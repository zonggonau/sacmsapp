-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'BUILDING', 'READY', 'LIVE', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WebsiteType" AS ENUM ('GOVERNMENT', 'COMPANY', 'ECOMMERCE', 'SCHOOL', 'HOSPITAL', 'HOTEL', 'RESTAURANT', 'PORTFOLIO', 'SAAS', 'LANDING', 'BLOG', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BuildJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuildJobKind" AS ENUM ('INITIAL_GENERATE', 'EDIT_GENERATE', 'DEPLOY');

-- CreateEnum
CREATE TYPE "BuildStepStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'BUILDING', 'READY', 'ERROR', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentTarget" AS ENUM ('PREVIEW', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING_DNS', 'VERIFYING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('AI_GENERATE', 'AI_EDIT', 'DEPLOY', 'PROJECT_CREATE');

-- CreateEnum
CREATE TYPE "UsageState" AS ENUM ('RESERVED', 'COMMITTED', 'REFUNDED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId" TEXT NOT NULL,
    "planExpiresAt" TIMESTAMP(3),
    "creditsOverride" INTEGER,
    "maxProjectsOverride" INTEGER,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "periodStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxProjects" INTEGER NOT NULL DEFAULT 1,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 30,
    "maxCustomDomains" INTEGER NOT NULL DEFAULT 0,
    "maxDeploysPerDay" INTEGER NOT NULL DEFAULT 3,
    "allowedModels" TEXT[] DEFAULT ARRAY['v0-1.5-sm']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "websiteType" "WebsiteType" NOT NULL DEFAULT 'CUSTOM',
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "initialPrompt" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "v0ProjectId" TEXT,
    "v0ChatId" TEXT,
    "vercelProjectId" TEXT,
    "previewUrl" TEXT,
    "productionUrl" TEXT,
    "currentVersionId" TEXT,
    "lastBuildAt" TIMESTAMP(3),
    "lastDeployAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_version" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "v0VersionId" TEXT,
    "demoUrl" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_message" (
    "id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "buildJobId" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_job" (
    "id" TEXT NOT NULL,
    "kind" "BuildJobKind" NOT NULL,
    "status" "BuildJobStatus" NOT NULL DEFAULT 'QUEUED',
    "projectId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawError" TEXT,
    "correlationId" TEXT NOT NULL,
    "creditsCost" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_step" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "BuildStepStatus" NOT NULL DEFAULT 'PENDING',
    "buildJobId" TEXT NOT NULL,
    "detail" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "build_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment" (
    "id" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'QUEUED',
    "target" "DeploymentTarget" NOT NULL DEFAULT 'PREVIEW',
    "projectId" TEXT NOT NULL,
    "versionId" TEXT,
    "buildJobId" TEXT,
    "vercelDeploymentId" TEXT,
    "url" TEXT,
    "errorMessage" TEXT,
    "logUrl" TEXT,
    "triggeredById" TEXT,
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING_DNS',
    "projectId" TEXT NOT NULL,
    "verificationToken" TEXT,
    "dnsRecords" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_event" (
    "id" TEXT NOT NULL,
    "kind" "UsageKind" NOT NULL,
    "state" "UsageState" NOT NULL DEFAULT 'RESERVED',
    "credits" INTEGER NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "buildJobId" TEXT,
    "vendorCostIdr" INTEGER,
    "model" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "targetType" TEXT,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE INDEX "user_planId_idx" ON "user"("planId");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "plan_slug_key" ON "plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_v0ChatId_key" ON "project"("v0ChatId");

-- CreateIndex
CREATE UNIQUE INDEX "project_currentVersionId_key" ON "project"("currentVersionId");

-- CreateIndex
CREATE INDEX "project_userId_status_idx" ON "project"("userId", "status");

-- CreateIndex
CREATE INDEX "project_userId_createdAt_idx" ON "project"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "project"("status");

-- CreateIndex
CREATE INDEX "project_deletedAt_idx" ON "project"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_userId_slug_key" ON "project"("userId", "slug");

-- CreateIndex
CREATE INDEX "project_version_projectId_createdAt_idx" ON "project_version"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_version_projectId_number_key" ON "project_version"("projectId", "number");

-- CreateIndex
CREATE INDEX "ai_message_projectId_createdAt_idx" ON "ai_message"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "build_job_correlationId_key" ON "build_job"("correlationId");

-- CreateIndex
CREATE INDEX "build_job_projectId_createdAt_idx" ON "build_job"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "build_job_status_createdAt_idx" ON "build_job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "build_job_status_timeoutAt_idx" ON "build_job"("status", "timeoutAt");

-- CreateIndex
CREATE INDEX "build_step_buildJobId_order_idx" ON "build_step"("buildJobId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "build_step_buildJobId_key_key" ON "build_step"("buildJobId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_vercelDeploymentId_key" ON "deployment"("vercelDeploymentId");

-- CreateIndex
CREATE INDEX "deployment_projectId_createdAt_idx" ON "deployment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "deployment_status_idx" ON "deployment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "domain_name_key" ON "domain"("name");

-- CreateIndex
CREATE INDEX "domain_projectId_idx" ON "domain"("projectId");

-- CreateIndex
CREATE INDEX "domain_status_idx" ON "domain"("status");

-- CreateIndex
CREATE INDEX "usage_event_userId_createdAt_idx" ON "usage_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_event_kind_createdAt_idx" ON "usage_event"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "usage_event_state_idx" ON "usage_event"("state");

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_read_createdAt_idx" ON "notification"("userId", "read", "createdAt");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "project_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_version" ADD CONSTRAINT "project_version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_message" ADD CONSTRAINT "ai_message_buildJobId_fkey" FOREIGN KEY ("buildJobId") REFERENCES "build_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_job" ADD CONSTRAINT "build_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_step" ADD CONSTRAINT "build_step_buildJobId_fkey" FOREIGN KEY ("buildJobId") REFERENCES "build_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "project_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment" ADD CONSTRAINT "deployment_buildJobId_fkey" FOREIGN KEY ("buildJobId") REFERENCES "build_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain" ADD CONSTRAINT "domain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_buildJobId_fkey" FOREIGN KEY ("buildJobId") REFERENCES "build_job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
