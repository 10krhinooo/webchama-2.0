DO $$ BEGIN
    CREATE TYPE activity_event_type AS ENUM (
        'MEMBER_INVITED', 'CONTRIBUTION_PAID', 'LOAN_APPROVED', 'PAYOUT_DISBURSED', 'DOCUMENT_GENERATED'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tenant-scoped audit trail, newest first per chama. Append-only, a row is never updated
-- once written.
CREATE TABLE activity_log (
    id           BIGSERIAL            PRIMARY KEY,
    chama_id     BIGINT               NOT NULL REFERENCES chama(id),
    event_type   activity_event_type  NOT NULL,
    description  TEXT                 NOT NULL,
    created_at   TIMESTAMPTZ          NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_chama_id_created_at ON activity_log(chama_id, created_at DESC);
