-- Continuation of V31: uses the loan_status/loan_disbursement_status enum values it just added,
-- which must be committed in a prior transaction before Postgres allows referencing them.

-- Both Safaricom-assigned identifiers are unknown until the paymentrequest call is acknowledged,
-- which now happens strictly after the row is persisted.
ALTER TABLE loan_disbursement ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE loan_disbursement ALTER COLUMN originator_conversation_id DROP NOT NULL;

ALTER TABLE loan_disbursement ALTER COLUMN status SET DEFAULT 'INITIATING';

-- DB-level backstop independent of the application's optimistic-lock claim: a loan can never have
-- more than one disbursement row in an active (not yet FAILED) state at a time.
CREATE UNIQUE INDEX idx_loan_disbursement_one_active_per_loan ON loan_disbursement(loan_id)
    WHERE status IN ('INITIATING', 'PENDING', 'COMPLETED');
