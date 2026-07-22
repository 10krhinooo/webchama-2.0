DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_purpose AS ENUM ('CONTRIBUTION', 'LOAN_REPAYMENT', 'PENALTY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Polymorphic payment ledger row backing contribution/loan_repayment/penalty (MIGRATION_PLAN.md
-- section 4). Only contribution_id is populated today, loan_repayment and penalty don't have
-- tables yet (Phase 4); the purpose column and the other two nullable FKs land now so a future
-- phase adds a column, not a migration of existing rows.
CREATE TABLE payment (
    id                    BIGSERIAL         PRIMARY KEY,
    chama_id              BIGINT            NOT NULL REFERENCES chama(id),
    member_id             BIGINT            NOT NULL REFERENCES member(id),
    contribution_id       BIGINT            REFERENCES contribution(id),
    purpose               payment_purpose   NOT NULL DEFAULT 'CONTRIBUTION',
    amount                NUMERIC(12,2)     NOT NULL,
    method                payment_method    NOT NULL,
    status                payment_status    NOT NULL DEFAULT 'PENDING',
    provider_reference    VARCHAR(200),
    mpesa_receipt_number  VARCHAR(100),
    paid_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- Idempotency key: a Daraja/Flutterwave webhook retry looks up by this reference before
-- updating status, so it must never resolve to more than one row.
CREATE UNIQUE INDEX idx_payment_provider_reference ON payment(provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payment_chama_id ON payment(chama_id);
CREATE INDEX idx_payment_contribution_id ON payment(contribution_id);
