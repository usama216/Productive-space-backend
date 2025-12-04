-- Create RoleChangeHistory table to track all user role changes
-- This provides an audit trail for admin actions

CREATE TABLE IF NOT EXISTS "RoleChangeHistory" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "previousRole" TEXT,
  "newRole" TEXT,
  reason TEXT,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_role_change_history_user ON "RoleChangeHistory"("userId");
CREATE INDEX IF NOT EXISTS idx_role_change_history_date ON "RoleChangeHistory"("changedAt" DESC);

-- Add comment for documentation
COMMENT ON TABLE "RoleChangeHistory" IS 'Tracks all changes to user roles (memberType) for audit purposes';
COMMENT ON COLUMN "RoleChangeHistory"."previousRole" IS 'The role before the change (ADMIN, STUDENT, MEMBER, TUTOR, or null)';
COMMENT ON COLUMN "RoleChangeHistory"."newRole" IS 'The role after the change (ADMIN, STUDENT, MEMBER, TUTOR, or null)';
COMMENT ON COLUMN "RoleChangeHistory"."changedBy" IS 'Admin user ID or identifier who made the change';
