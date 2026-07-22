DO $$ BEGIN
    CREATE TYPE interest_method AS ENUM ('FLAT', 'REDUCING_BALANCE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'REPAYING', 'CLOSED', 'DEFAULTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_repayment_status AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE loan (
    id                     BIGSERIAL              PRIMARY KEY,
    chama_id               BIGINT                 NOT NULL REFERENCES chama(id),
    member_id              BIGINT                 NOT NULL REFERENCES member(id),
    principal              NUMERIC(12,2)          NOT NULL,
    interest_rate          NUMERIC(5,2)           NOT NULL,
    interest_method        interest_method        NOT NULL,
    term_months            INTEGER                NOT NULL,
    status                 loan_status            NOT NULL DEFAULT 'REQUESTED',
    approved_by_member_id  BIGINT                 REFERENCES member(id),
    approved_at            TIMESTAMPTZ,
    disbursed_at           TIMESTAMPTZ,
    requested_at           TIMESTAMPTZ            NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_chama_id ON loan(chama_id);
CREATE INDEX idx_loan_member_id ON loan(member_id);

CREATE TABLE loan_repayment (
    id                  BIGSERIAL              PRIMARY KEY,
    loan_id             BIGINT                 NOT NULL REFERENCES loan(id),
    installment_number  INTEGER                NOT NULL,
    scheduled_date      DATE                   NOT NULL,
    amount_due          NUMERIC(12,2)          NOT NULL,
    amount_paid         NUMERIC(12,2)          NOT NULL DEFAULT 0,
    status              loan_repayment_status  NOT NULL DEFAULT 'PENDING',
    UNIQUE (loan_id, installment_number)
);

CREATE INDEX idx_loan_repayment_loan_id ON loan_repayment(loan_id);
