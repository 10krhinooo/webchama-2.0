DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE meeting (
    id           BIGSERIAL    PRIMARY KEY,
    chama_id     BIGINT       NOT NULL REFERENCES chama(id),
    meeting_date DATE         NOT NULL,
    agenda       TEXT         NOT NULL,
    minutes      TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_chama_id ON meeting(chama_id);

CREATE TABLE meeting_attendance (
    id          BIGSERIAL           PRIMARY KEY,
    meeting_id  BIGINT              NOT NULL REFERENCES meeting(id),
    member_id   BIGINT              NOT NULL REFERENCES member(id),
    status      attendance_status   NOT NULL,
    UNIQUE (meeting_id, member_id)
);

CREATE INDEX idx_meeting_attendance_meeting_id ON meeting_attendance(meeting_id);
