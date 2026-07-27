-- Per-chama controls for the auto-STK-push sweep (issue #60 follow-up): a chairperson or
-- treasurer can turn the sweep off for their chama, or change how many hours must pass since
-- the last push before a still-unpaid contribution gets pushed again.
ALTER TABLE chama ADD COLUMN auto_push_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE chama ADD COLUMN auto_push_retry_hours INTEGER NOT NULL DEFAULT 24;
