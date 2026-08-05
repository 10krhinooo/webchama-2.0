-- New activity feed event types for this module (ActivityLogService/ActivityEventType), added
-- to the existing activity_event_type enum alongside the values V15, V18, and V20 already added.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'RESOLUTION_OPENED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'RESOLUTION_CLOSED';

DO $$ BEGIN
    CREATE TYPE resolution_status AS ENUM ('OPEN', 'PASSED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vote_choice AS ENUM ('FOR', 'AGAINST', 'ABSTAIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE resolution (
    id                   BIGSERIAL           PRIMARY KEY,
    chama_id             BIGINT              NOT NULL REFERENCES chama(id),
    meeting_id           BIGINT              NOT NULL REFERENCES meeting(id),
    title                TEXT                NOT NULL,
    description          TEXT,
    status               resolution_status   NOT NULL DEFAULT 'OPEN',
    opened_by_member_id  BIGINT              NOT NULL REFERENCES member(id),
    opened_at            TIMESTAMPTZ         NOT NULL DEFAULT now(),
    closed_at            TIMESTAMPTZ,
    version              BIGINT              NOT NULL DEFAULT 0
);

CREATE INDEX idx_resolution_chama_id ON resolution(chama_id);
CREATE INDEX idx_resolution_meeting_id ON resolution(meeting_id);

CREATE TABLE resolution_vote (
    id             BIGSERIAL     PRIMARY KEY,
    resolution_id  BIGINT        NOT NULL REFERENCES resolution(id),
    member_id      BIGINT        NOT NULL REFERENCES member(id),
    choice         vote_choice   NOT NULL,
    voted_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (resolution_id, member_id)
);

CREATE INDEX idx_resolution_vote_resolution_id ON resolution_vote(resolution_id);
