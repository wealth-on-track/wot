-- CreateTable
CREATE TABLE "SystemActivityLog" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemActivityLog_createdAt_idx" ON "SystemActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemActivityLog_userId_createdAt_idx" ON "SystemActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemActivityLog_activityType_action_idx" ON "SystemActivityLog"("activityType", "action");

-- CreateIndex
CREATE INDEX "SystemActivityLog_username_createdAt_idx" ON "SystemActivityLog"("username", "createdAt");
