DO $$ BEGIN
    CREATE TYPE approval_target_type AS ENUM ('LOAN_DISBURSEMENT', 'PAYOUT_DISBURSEMENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE approval (
    id                   BIGSERIAL              PRIMARY KEY,
    chama_id             BIGINT                  NOT NULL REFERENCES chama(id),
    target_type          approval_target_type    NOT NULL,
    target_id            BIGINT                  NOT NULL,
    member_id            BIGINT                  NOT NULL REFERENCES member(id),
    amount               NUMERIC(12,2)           NOT NULL,
    reason               TEXT,
    status               approval_status         NOT NULL DEFAULT 'PENDING',
    requested_by_id      BIGINT                  NOT NULL REFERENCES member(id),
    requested_at         TIMESTAMPTZ             NOT NULL DEFAULT now(),
    first_approver_id    BIGINT                  REFERENCES member(id),
    first_approved_at    TIMESTAMPTZ,
    second_approver_id   BIGINT                  REFERENCES member(id),
    second_approved_at   TIMESTAMPTZ,
    version              BIGINT                  NOT NULL DEFAULT 0
);

CREATE INDEX idx_approval_chama_id ON approval(chama_id);
CREATE INDEX idx_approval_target ON approval(target_type, target_id);
CREATE INDEX idx_approval_status ON approval(status);
