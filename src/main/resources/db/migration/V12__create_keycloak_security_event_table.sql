DO $$ BEGIN
    CREATE TYPE keycloak_event_source AS ENUM ('LOGIN', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE keycloak_security_event (
    id                BIGSERIAL                  PRIMARY KEY,
    source            keycloak_event_source       NOT NULL,
    event_time        TIMESTAMPTZ                 NOT NULL,
    type              VARCHAR(64)                 NOT NULL,
    realm_id          VARCHAR(64),
    keycloak_user_id  VARCHAR(64),
    ip_address        VARCHAR(64),
    client_id         VARCHAR(128),
    session_id        VARCHAR(64),
    error             VARCHAR(128),
    resource_type     VARCHAR(64),
    resource_path     VARCHAR(255),
    details           TEXT,
    dedupe_key        VARCHAR(512)                NOT NULL UNIQUE,
    ingested_at       TIMESTAMPTZ                 NOT NULL DEFAULT now()
);

CREATE INDEX idx_keycloak_security_event_event_time ON keycloak_security_event(event_time);
CREATE INDEX idx_keycloak_security_event_type ON keycloak_security_event(type);
CREATE INDEX idx_keycloak_security_event_error ON keycloak_security_event(error);
CREATE INDEX idx_keycloak_security_event_keycloak_user_id ON keycloak_security_event(keycloak_user_id);
