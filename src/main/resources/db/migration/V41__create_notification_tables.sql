DO $$ BEGIN
    CREATE TYPE notification_event_family AS ENUM (
        'CONTRIBUTION', 'PAYMENT', 'LOAN', 'PAYOUT', 'PENALTY',
        'MEETING', 'RESOLUTION', 'WELFARE', 'APPROVAL', 'DOCUMENT',
        'MEMBERSHIP', 'REMINDER'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- A user's notification inbox.
--
-- Keyed on keycloak_user_id rather than member_id, because a notification belongs to a person
-- rather than to one of their memberships. Someone in three chamas has one inbox, and the bell is
-- shown on pages such as /my-chamas where no chama is in the route at all.
--
-- chama_id is context, not the partition key: it is nullable because some notifications (an
-- invitation, for instance) exist before the recipient is a member of anything, and it is what
-- the "link" deep-links into when present.
CREATE TABLE notification (
    id                BIGSERIAL                  PRIMARY KEY,
    keycloak_user_id  TEXT                       NOT NULL,
    -- ON DELETE CASCADE rather than the explicit-delete-in-order pattern the older tables use.
    -- A notification about a chama that no longer exists is noise carrying a dead link, so there
    -- is no case where it should outlive its chama or block the delete. It also keeps the table
    -- out of the hand-maintained cleanup list every test class carries, which is otherwise the
    -- thing a new table silently breaks.
    chama_id          BIGINT                     REFERENCES chama(id) ON DELETE CASCADE,
    event_family      notification_event_family  NOT NULL,
    title             TEXT                       NOT NULL,
    body              TEXT                       NOT NULL,
    -- Client-side route to open when the notification is clicked, for example
    -- "/chamas/4/loans". Nullable, since not every notification has somewhere to go.
    link              TEXT,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ                NOT NULL DEFAULT now()
);

-- The two queries the bell actually makes: the newest page of the inbox, and the unread count.
-- The second is partial so it stays small as read history accumulates.
CREATE INDEX idx_notification_user_created ON notification(keycloak_user_id, created_at DESC);
CREATE INDEX idx_notification_user_unread ON notification(keycloak_user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notification_chama_id ON notification(chama_id);

-- Per-user delivery preferences, one row per event family the user has expressed an opinion on.
--
-- Global to the user rather than per chama. Several senders fire with no chama context at all, so
-- a per-chama key could not be resolved for them, and "email me about loans" is a preference about
-- the kind of event rather than about one group.
--
-- An absent row means both channels are on, so a new event family does not need a backfill and
-- silence is never mistaken for opting out.
CREATE TABLE notification_preference (
    id                BIGSERIAL                  PRIMARY KEY,
    keycloak_user_id  TEXT                       NOT NULL,
    event_family      notification_event_family  NOT NULL,
    in_app_enabled    BOOLEAN                    NOT NULL DEFAULT true,
    email_enabled     BOOLEAN                    NOT NULL DEFAULT true,
    CONSTRAINT uq_notification_preference UNIQUE (keycloak_user_id, event_family)
);
