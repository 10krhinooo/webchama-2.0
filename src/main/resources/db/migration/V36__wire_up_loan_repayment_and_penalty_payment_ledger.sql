-- AUDIT_PLAN.md P2-16: payment_purpose already carried LOAN_REPAYMENT/PENALTY, but no code path
-- ever created a Payment row for either, and Payment itself had nowhere to attach one (no FK to
-- loan_repayment or penalty). This closes both gaps: a PAID status for a penalty to actually
-- settle into, and the two missing polymorphic FK columns on payment, mirroring contribution_id/
-- welfare_contribution_id.
ALTER TYPE penalty_status ADD VALUE IF NOT EXISTS 'PAID';

ALTER TABLE payment ADD COLUMN loan_repayment_id BIGINT REFERENCES loan_repayment(id);
ALTER TABLE payment ADD COLUMN penalty_id BIGINT REFERENCES penalty(id);

CREATE INDEX idx_payment_loan_repayment_id ON payment(loan_repayment_id);
CREATE INDEX idx_payment_penalty_id ON payment(penalty_id);
