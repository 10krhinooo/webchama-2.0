DO $$ BEGIN
    CREATE TYPE penalty_reason AS ENUM ('LATE_CONTRIBUTION', 'MISSED_MEETING', 'LOAN_DEFAULT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE penalty_status AS ENUM ('PENDING', 'APPROVED', 'WAIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE penalty (
    id                     BIGSERIAL       PRIMARY KEY,
    chama_id               BIGINT          NOT NULL REFERENCES chama(id),
    member_id              BIGINT          NOT NULL REFERENCES member(id),
    reason                 penalty_reason  NOT NULL,
    amount                 NUMERIC(12,2)   NOT NULL,
    status                 penalty_status  NOT NULL DEFAULT 'PENDING',
    decided_by_member_id   BIGINT          REFERENCES member(id),
    decided_at             TIMESTAMPTZ,
    waiver_reason          TEXT,
    version                BIGINT          NOT NULL DEFAULT 0,
    imposed_at             TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_penalty_chama_id ON penalty(chama_id);
CREATE INDEX idx_penalty_member_id ON penalty(member_id);
