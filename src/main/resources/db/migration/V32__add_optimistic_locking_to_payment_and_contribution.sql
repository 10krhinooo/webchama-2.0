-- Audit finding P0-5: unlike Loan, LoanDisbursement, Payout, Penalty, and Approval, payment and
-- contribution had no optimistic-locking column, so two near-simultaneous webhook deliveries for
-- the same payment could both read status = PENDING before either commits and both credit the
-- balance. Same pattern as V8's loan.version.
ALTER TABLE payment ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE contribution ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
