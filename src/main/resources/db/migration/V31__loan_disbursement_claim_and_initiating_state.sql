-- Audit findings P0-3/P0-4: a loan_disbursement row is now persisted (status INITIATING) and
-- committed before the B2C paymentrequest call fires, and the owning loan is atomically claimed
-- (status DISBURSEMENT_PENDING) at the same time, so a commit failure after Safaricom accepts the
-- payout can never lose the only record it happened, and a double-click/retry can't fire a second
-- real payout for the same loan.
--
-- The new enum values are added in their own migration (this file) so they are committed before
-- V31.1 uses them, Postgres rejects using an enum value added earlier in the same transaction
-- ("unsafe use of new value").

ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'DISBURSEMENT_PENDING';
ALTER TYPE loan_disbursement_status ADD VALUE IF NOT EXISTS 'INITIATING';
