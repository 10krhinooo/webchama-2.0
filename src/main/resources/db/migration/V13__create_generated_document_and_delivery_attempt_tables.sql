DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('CONTRIBUTION_RECEIPT', 'LOAN_STATEMENT', 'PAYOUT_RECEIPT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_channel AS ENUM ('EMAIL', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Generated PDF statements/receipts (contribution receipt, loan statement, payout receipt):
-- a denormalized snapshot (member name/email/phone captured at generation time) holding the
-- rendered PDF bytes plus a last-write-wins status per delivery channel. Exactly one of
-- contribution_id/loan_id/payout_id is populated depending on document_type, same
-- polymorphic-nullable-FK convention as the payment table (issue #41).
CREATE TABLE generated_document (
    id                 BIGSERIAL         PRIMARY KEY,
    chama_id           BIGINT            NOT NULL REFERENCES chama(id),
    member_id          BIGINT            NOT NULL REFERENCES member(id),
    contribution_id    BIGINT            REFERENCES contribution(id),
    loan_id            BIGINT            REFERENCES loan(id),
    payout_id          BIGINT            REFERENCES payout(id),
    document_type      document_type     NOT NULL,
    document_number    VARCHAR(30)       NOT NULL,
    member_name        VARCHAR(200)      NOT NULL,
    member_email       VARCHAR(200),
    member_phone       VARCHAR(30),
    line_items_json    TEXT              NOT NULL,
    total_amount       NUMERIC(14,2)     NOT NULL,
    billing_period     VARCHAR(50),
    notes              TEXT,
    pdf_bytes          BYTEA,
    email_status       delivery_status,
    email_sent_at      TIMESTAMPTZ,
    email_error        TEXT,
    whatsapp_status    delivery_status,
    whatsapp_sent_at   TIMESTAMPTZ,
    whatsapp_error     TEXT,
    created_at         TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_document_chama_id ON generated_document(chama_id);
CREATE INDEX idx_generated_document_member_id ON generated_document(member_id);
CREATE UNIQUE INDEX idx_generated_document_number ON generated_document(document_number);

-- Full per-attempt delivery ledger (every attempt, success or failure), distinct from
-- generated_document's last-write-wins email_status/whatsapp_status which only reflect the most
-- recent attempt.
CREATE TABLE document_delivery_attempt (
    id             BIGSERIAL        PRIMARY KEY,
    document_id    BIGINT           NOT NULL REFERENCES generated_document(id) ON DELETE CASCADE,
    channel        delivery_channel NOT NULL,
    status         delivery_status  NOT NULL,
    error_detail   TEXT,
    attempted_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_delivery_attempt_document_id ON document_delivery_attempt(document_id);
