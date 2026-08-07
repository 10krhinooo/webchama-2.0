-- AUDIT_PLAN.md P2-15: every money column allowed negative values at the DB layer, with only
-- @Positive on create DTOs as a defense. CHECK constraints back that up at the schema level so a
-- bug or a direct SQL write can never leave a negative balance/amount behind.
ALTER TABLE contribution ADD CONSTRAINT chk_contribution_amount_due_nonneg CHECK (amount_due >= 0);
ALTER TABLE contribution ADD CONSTRAINT chk_contribution_amount_paid_nonneg CHECK (amount_paid >= 0);

ALTER TABLE loan_repayment ADD CONSTRAINT chk_loan_repayment_amount_due_nonneg CHECK (amount_due >= 0);
ALTER TABLE loan_repayment ADD CONSTRAINT chk_loan_repayment_amount_paid_nonneg CHECK (amount_paid >= 0);

ALTER TABLE approval ADD CONSTRAINT chk_approval_amount_nonneg CHECK (amount >= 0);

ALTER TABLE payout ADD CONSTRAINT chk_payout_amount_nonneg CHECK (amount >= 0);

ALTER TABLE penalty ADD CONSTRAINT chk_penalty_amount_nonneg CHECK (amount >= 0);

ALTER TABLE welfare_contribution ADD CONSTRAINT chk_welfare_contribution_amount_nonneg CHECK (amount >= 0);
ALTER TABLE welfare_withdrawal ADD CONSTRAINT chk_welfare_withdrawal_amount_nonneg CHECK (amount >= 0);
ALTER TABLE welfare_fund ADD CONSTRAINT chk_welfare_fund_balance_nonneg CHECK (balance >= 0);

ALTER TABLE chama ADD CONSTRAINT chk_chama_contribution_amount_nonneg CHECK (contribution_amount >= 0);
ALTER TABLE chama ADD CONSTRAINT chk_chama_approval_threshold_nonneg CHECK (approval_threshold IS NULL OR approval_threshold >= 0);
ALTER TABLE chama ADD CONSTRAINT chk_chama_savings_target_nonneg CHECK (savings_target IS NULL OR savings_target >= 0);

ALTER TABLE generated_document ADD CONSTRAINT chk_generated_document_total_amount_nonneg CHECK (total_amount >= 0);

ALTER TABLE payment ADD CONSTRAINT chk_payment_amount_nonneg CHECK (amount >= 0);

ALTER TABLE loan_disbursement ADD CONSTRAINT chk_loan_disbursement_amount_nonneg CHECK (amount >= 0);

ALTER TABLE loan ADD CONSTRAINT chk_loan_principal_nonneg CHECK (principal >= 0);
ALTER TABLE loan ADD CONSTRAINT chk_loan_interest_rate_nonneg CHECK (interest_rate >= 0);

-- AUDIT_PLAN.md P3: initiateCardPayment had no guard against a second PENDING payment on the same
-- contribution (unlike initiateMpesaPayment's app-level check), and even that app-level check was
-- a plain read-then-write with no DB backing, so concurrent requests could still race past it. A
-- partial unique index closes both gaps at once, for every payment method, at the DB layer.
CREATE UNIQUE INDEX idx_payment_one_pending_per_contribution
    ON payment(contribution_id)
    WHERE status = 'PENDING' AND contribution_id IS NOT NULL;
