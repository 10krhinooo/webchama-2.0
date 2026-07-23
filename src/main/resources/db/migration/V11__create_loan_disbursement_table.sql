DO $$ BEGIN
    CREATE TYPE loan_disbursement_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE loan_disbursement (
    id                          BIGSERIAL                   PRIMARY KEY,
    loan_id                     BIGINT                       NOT NULL REFERENCES loan(id),
    conversation_id             VARCHAR(100)                 NOT NULL,
    originator_conversation_id  VARCHAR(100)                 NOT NULL,
    target_phone                VARCHAR(20)                  NOT NULL,
    amount                      NUMERIC(12,2)                NOT NULL,
    status                      loan_disbursement_status     NOT NULL DEFAULT 'PENDING',
    result_code                 VARCHAR(20),
    result_description          TEXT,
    transaction_id              VARCHAR(100),
    disbursed_at                TIMESTAMPTZ,
    requested_at                TIMESTAMPTZ                  NOT NULL DEFAULT now(),
    version                     BIGINT                       NOT NULL DEFAULT 0,
    UNIQUE (conversation_id)
);

CREATE INDEX idx_loan_disbursement_loan_id ON loan_disbursement(loan_id);
CREATE INDEX idx_loan_disbursement_status ON loan_disbursement(status);
