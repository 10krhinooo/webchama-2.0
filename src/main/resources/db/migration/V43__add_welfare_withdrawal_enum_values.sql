-- Enum values needed by the welfare fund withdrawal sign-off flow: the approval target type it is
-- gated by, and the activity event recorded when a withdrawal is requested rather than disbursed.
--
-- On their own, deliberately. Postgres refuses to use an enum value inside the transaction that
-- added it, and Flyway wraps each migration in one transaction, so nothing in V44 could reference
-- these if they were added there. V22 and V40 are split for the same reason.
ALTER TYPE approval_target_type ADD VALUE IF NOT EXISTS 'WELFARE_WITHDRAWAL';

-- Extends the activity_event_type enum created in V15, previously extended in V18, V20, V21, V23,
-- V25, V30, V34 and V40.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'WELFARE_FUND_WITHDRAWAL_REQUESTED';
