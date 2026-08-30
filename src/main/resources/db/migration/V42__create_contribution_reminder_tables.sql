DO $$ BEGIN
    CREATE TYPE reminder_kind AS ENUM ('UPCOMING', 'DUE_TODAY', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Per-chama reminder settings, created lazily on first access the way welfare_fund is, so a chama
-- that never opens the panel never gets a row. A separate table rather than five more columns on
-- chama, which already carries the contribution schedule, the auto-push settings, the approval
-- threshold and the savings target.
--
-- enabled defaults to false, deliberately. Turning this on for every existing chama at migration
-- time would mean that the next morning every member of every chama receives email nobody asked
-- for. A chairperson opts in.
CREATE TABLE chama_reminder_settings (
    id                  BIGSERIAL       PRIMARY KEY,
    chama_id            BIGINT          NOT NULL UNIQUE REFERENCES chama(id) ON DELETE CASCADE,
    enabled             BOOLEAN         NOT NULL DEFAULT false,
    -- How many days ahead of the due date the first nudge goes out.
    days_before_due     INT             NOT NULL DEFAULT 3,
    -- How often to nudge again once a contribution is overdue.
    overdue_every_days  INT             NOT NULL DEFAULT 7,
    -- Hour of the Nairobi day to send at, 0 to 23. The sweep runs hourly and acts only in this
    -- hour, so a restart or a missed tick self-heals on the next run rather than sending at 3am.
    send_hour           INT             NOT NULL DEFAULT 8,
    version             BIGINT          NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT chk_reminder_days_before_due CHECK (days_before_due BETWEEN 1 AND 30),
    CONSTRAINT chk_reminder_overdue_every_days CHECK (overdue_every_days BETWEEN 1 AND 30),
    CONSTRAINT chk_reminder_send_hour CHECK (send_hour BETWEEN 0 AND 23)
);

-- The idempotency ledger, and the audit record of what was actually sent.
--
-- The unique constraint is the whole mechanism: the sweep claims a row with INSERT ... ON CONFLICT
-- DO NOTHING and only sends if the insert took effect, so two instances sweeping the same hour
-- cannot both nudge the same member. A select-then-insert would not be atomic across instances.
--
-- scheduled_for is the Nairobi date the reminder was for, which is what makes repeat overdue
-- nudges distinct rows rather than collisions.
--
-- Nothing here is written to activity_log. One row per member per reminder would bury the genuine
-- financial and governance events the feed exists to show; this table is the record instead.
CREATE TABLE reminder_dispatch (
    id               BIGSERIAL      PRIMARY KEY,
    contribution_id  BIGINT         NOT NULL REFERENCES contribution(id) ON DELETE CASCADE,
    reminder_kind    reminder_kind  NOT NULL,
    scheduled_for    DATE           NOT NULL,
    sent_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT uq_reminder_dispatch UNIQUE (contribution_id, reminder_kind, scheduled_for)
);

CREATE INDEX idx_reminder_dispatch_contribution ON reminder_dispatch(contribution_id);
