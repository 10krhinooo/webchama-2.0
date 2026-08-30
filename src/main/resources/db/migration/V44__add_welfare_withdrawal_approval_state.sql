-- Splits a welfare fund withdrawal into a request and a disbursement, so one above the chama's
-- approval threshold goes through the same maker-checker sign-off that loan disbursements and
-- payouts already require. Until now this was the one path that moved real money on a single
-- person's say-so, with nothing but a balance check in front of it.
DO $$ BEGIN
    CREATE TYPE welfare_withdrawal_status AS ENUM ('PENDING_APPROVAL', 'DISBURSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Who asked, as distinct from who released the money. The maker cannot be a checker, so these two
-- must be recorded separately even though they were the same person under the old flow.
ALTER TABLE welfare_withdrawal ADD COLUMN requested_by_member_id BIGINT REFERENCES member(id);
ALTER TABLE welfare_withdrawal ADD COLUMN requested_at TIMESTAMPTZ;
ALTER TABLE welfare_withdrawal ADD COLUMN status welfare_withdrawal_status;

-- Existing rows are backfilled as DISBURSED, never as PENDING_APPROVAL. Those withdrawals really
-- happened and the money really left the fund; marking them pending would retroactively un-disburse
-- money that is already gone, and the balance would no longer reconcile against the ledger.
UPDATE welfare_withdrawal
   SET status = 'DISBURSED',
       requested_by_member_id = disbursed_by_member_id,
       requested_at = disbursed_at
 WHERE status IS NULL;

ALTER TABLE welfare_withdrawal ALTER COLUMN requested_by_member_id SET NOT NULL;
ALTER TABLE welfare_withdrawal ALTER COLUMN requested_at SET NOT NULL;
ALTER TABLE welfare_withdrawal ALTER COLUMN requested_at SET DEFAULT now();
ALTER TABLE welfare_withdrawal ALTER COLUMN status SET NOT NULL;
ALTER TABLE welfare_withdrawal ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';

-- A withdrawal awaiting sign-off has not been disbursed by anyone yet, so these two stop being
-- mandatory and become the record of the second step.
ALTER TABLE welfare_withdrawal ALTER COLUMN disbursed_by_member_id DROP NOT NULL;
ALTER TABLE welfare_withdrawal ALTER COLUMN disbursed_at DROP NOT NULL;
ALTER TABLE welfare_withdrawal ALTER COLUMN disbursed_at DROP DEFAULT;

-- Both halves must be set together or not at all: a row cannot claim it was disbursed without
-- recording who released it, and cannot name a disburser while still pending.
ALTER TABLE welfare_withdrawal ADD CONSTRAINT chk_welfare_withdrawal_disbursement_complete
    CHECK ((status = 'DISBURSED') = (disbursed_by_member_id IS NOT NULL AND disbursed_at IS NOT NULL));

CREATE INDEX idx_welfare_withdrawal_status ON welfare_withdrawal(chama_id, status);
