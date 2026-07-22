DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('ACTIVE', 'SUSPENDED', 'EXITED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_role_type AS ENUM ('CHAIRPERSON', 'TREASURER', 'SECRETARY', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- One row per (person, chama). A person in more than one chama has more
-- than one row here, one per chama, see Member.java for why.
CREATE TABLE member (
    id                BIGSERIAL       PRIMARY KEY,
    chama_id          BIGINT          NOT NULL REFERENCES chama(id),
    keycloak_user_id  VARCHAR(255)    NOT NULL,
    full_name         VARCHAR(255)    NOT NULL,
    phone             VARCHAR(20)     NOT NULL,
    national_id       VARCHAR(20),
    next_of_kin       VARCHAR(255),
    join_date         DATE            NOT NULL DEFAULT CURRENT_DATE,
    status            member_status   NOT NULL DEFAULT 'ACTIVE',
    UNIQUE (chama_id, keycloak_user_id)
);

CREATE INDEX idx_member_keycloak_user_id ON member(keycloak_user_id);
CREATE INDEX idx_member_chama_id ON member(chama_id);

CREATE TABLE member_role (
    id         BIGSERIAL          PRIMARY KEY,
    member_id  BIGINT             NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    role       member_role_type   NOT NULL,
    UNIQUE (member_id, role)
);

CREATE INDEX idx_member_role_member_id ON member_role(member_id);
