-- Audit findings P0-3/P0-4: a loan_disbursement row is now persisted (status INITIATING) and
-- committed before the B2C paymentrequest call fires, and the owning loan is atomically claimed
-- (status DISBURSEMENT_PENDING) at the same time, so a commit failure after Safaricom accepts the
-- payout can never lose the only record it happened, and a double-click/retry can't fire a second
-- real payout for the same loan.

ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'DISBURSEMENT_PENDING';
ALTER TYPE loan_disbursement_status ADD VALUE IF NOT EXISTS 'INITIATING';

-- Both Safaricom-assigned identifiers are unknown until the paymentrequest call is acknowledged,
-- which now happens strictly after the row is persisted.
ALTER TABLE loan_disbursement ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE loan_disbursement ALTER COLUMN originator_conversation_id DROP NOT NULL;

ALTER TABLE loan_disbursement ALTER COLUMN status SET DEFAULT 'INITIATING';

-- DB-level backstop independent of the application's optimistic-lock claim: a loan can never have
-- more than one disbursement row in an active (not yet FAILED) state at a time.
CREATE UNIQUE INDEX idx_loan_disbursement_one_active_per_loan ON loan_disbursement(loan_id)
    WHERE status IN ('INITIATING', 'PENDING', 'COMPLETED');
