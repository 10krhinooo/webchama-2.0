-- When an installment was actually settled, as opposed to when it was scheduled.
--
-- Without this the only date on a repayment is scheduled_date, so nothing can tell an installment
-- paid on the day it fell due from one paid four months late. Credit scoring needs that
-- distinction, and statement generation currently uses scheduled_date as an explicit stand-in for
-- it.
--
-- Left null for rows that predate the column. A null is honestly "not known" rather than a guess,
-- and scoring skips those rows instead of scoring them as on time, which back-filling with
-- scheduled_date would have done.
ALTER TABLE loan_repayment ADD COLUMN paid_at TIMESTAMPTZ;

-- Credit scoring reads every settled installment for a chama in one pass.
CREATE INDEX idx_loan_repayment_paid_at ON loan_repayment(paid_at) WHERE paid_at IS NOT NULL;
