DO $$ BEGIN
    CREATE TYPE chama_type AS ENUM ('MERRY_GO_ROUND', 'TABLE_BANKING', 'INVESTMENT_GROUP');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contribution_frequency AS ENUM ('WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chama_status AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE chama (
    id                      BIGSERIAL               PRIMARY KEY,
    name                    VARCHAR(255)             NOT NULL,
    description             TEXT,
    type                    chama_type               NOT NULL,
    currency                VARCHAR(3)               NOT NULL DEFAULT 'KES',
    contribution_frequency  contribution_frequency   NOT NULL,
    contribution_amount     NUMERIC(12,2)            NOT NULL,
    meeting_day             VARCHAR(20),
    status                  chama_status             NOT NULL DEFAULT 'ACTIVE',
    created_at              TIMESTAMPTZ              NOT NULL DEFAULT now()
);
