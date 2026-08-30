-- Indexes for the chama analytics aggregates. Each one exists because a specific query would
-- otherwise scan the whole table for a single chama's slice of it.

-- The contribution trend groups by month within one chama, and the arrears buckets scan the
-- unsettled tail of the same range.
CREATE INDEX IF NOT EXISTS idx_contribution_chama_period ON contribution(chama_id, period);

-- Arrears only ever look at contributions that still owe something, which is a small and slowly
-- growing fraction of the table, so the partial index stays far smaller than the full one.
CREATE INDEX IF NOT EXISTS idx_contribution_chama_unsettled ON contribution(chama_id, period)
    WHERE status <> 'PAID';

-- The loan portfolio groups a chama's loans by status.
CREATE INDEX IF NOT EXISTS idx_loan_chama_status ON loan(chama_id, status);

-- Repayment totals join back to the loan, so the join column needs its own index.
CREATE INDEX IF NOT EXISTS idx_loan_repayment_loan_id ON loan_repayment(loan_id);

-- Attendance feeds the health score and is read per chama through the meeting.
CREATE INDEX IF NOT EXISTS idx_meeting_chama_date ON meeting(chama_id, meeting_date);
