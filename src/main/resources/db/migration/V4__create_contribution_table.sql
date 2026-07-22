DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('MPESA', 'CARD', 'CASH', 'BANK');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contribution_status AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE contribution (
    id              BIGSERIAL              PRIMARY KEY,
    chama_id        BIGINT                 NOT NULL REFERENCES chama(id),
    member_id       BIGINT                 NOT NULL REFERENCES member(id),
    period          DATE                   NOT NULL,
    amount_due      NUMERIC(12,2)          NOT NULL,
    amount_paid     NUMERIC(12,2)          NOT NULL DEFAULT 0,
    payment_method  payment_method,
    status          contribution_status    NOT NULL DEFAULT 'PENDING',
    paid_at         TIMESTAMPTZ,
    UNIQUE (member_id, period)
);

CREATE INDEX idx_contribution_chama_id ON contribution(chama_id);
CREATE INDEX idx_contribution_member_id ON contribution(member_id);
