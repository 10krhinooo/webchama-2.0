DO $$ BEGIN
    CREATE TYPE rotation_order_type AS ENUM ('RANDOM', 'SENIORITY', 'AGREED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_schedule_entry_status AS ENUM ('ACTIVE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('SCHEDULED', 'DISBURSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- One row per (chama, member): the member's slot in the current merry-go-round
-- rotation. The full generated order for a chama is the set of its ACTIVE rows
-- read back ordered by sequence_position.
CREATE TABLE payout_schedule (
    id                   BIGSERIAL                     PRIMARY KEY,
    chama_id             BIGINT                        NOT NULL REFERENCES chama(id),
    member_id            BIGINT                        NOT NULL REFERENCES member(id),
    rotation_order_type  rotation_order_type           NOT NULL,
    sequence_position    INTEGER                       NOT NULL,
    status               payout_schedule_entry_status  NOT NULL DEFAULT 'ACTIVE',
    created_at           TIMESTAMPTZ                   NOT NULL DEFAULT now(),
    UNIQUE (chama_id, member_id)
);

CREATE INDEX idx_payout_schedule_chama_id ON payout_schedule(chama_id);

-- One row per rotation round, the actual payout ledger.
CREATE TABLE payout (
    id             BIGSERIAL      PRIMARY KEY,
    chama_id       BIGINT         NOT NULL REFERENCES chama(id),
    member_id      BIGINT         NOT NULL REFERENCES member(id),
    round_number   INTEGER        NOT NULL,
    scheduled_date DATE           NOT NULL,
    amount         NUMERIC(12,2)  NOT NULL,
    status         payout_status  NOT NULL DEFAULT 'SCHEDULED',
    disbursed_at   TIMESTAMPTZ,
    version        BIGINT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    UNIQUE (chama_id, round_number)
);

CREATE INDEX idx_payout_chama_id ON payout(chama_id);
CREATE INDEX idx_payout_member_id ON payout(member_id);
