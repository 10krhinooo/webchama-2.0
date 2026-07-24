-- Welfare/emergency fund tracking (issue #65): the chama's emergency pot is modeled as a
-- genuinely distinct fund per chama rather than folding it into regular contributions, so a
-- welfare payment can never be mistaken for a regular dues payment in the contribution ledger.

ALTER TYPE payment_purpose ADD VALUE IF NOT EXISTS 'WELFARE';

ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'WELFARE_CONTRIBUTION_PAID';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'WELFARE_FUND_WITHDRAWN';

DO $$ BEGIN
    CREATE TYPE welfare_contribution_status AS ENUM ('PENDING', 'PAID');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- One row per chama, lazily created on first access. Holds the running balance so a
-- chairperson/treasurer can read the pot's current size without summing the ledger every time.
CREATE TABLE welfare_fund (
    id          BIGSERIAL       PRIMARY KEY,
    chama_id    BIGINT          NOT NULL UNIQUE REFERENCES chama(id),
    balance     NUMERIC(12,2)   NOT NULL DEFAULT 0,
    version     BIGINT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- A member's voluntary top-up into the welfare fund. Unlike a regular contribution there is no
-- amount_due/amount_paid split, a welfare contribution is always for the amount the member
-- chose to pay, so it is simply PENDING until the payment clears and PAID once it does.
CREATE TABLE welfare_contribution (
    id              BIGSERIAL                      PRIMARY KEY,
    chama_id        BIGINT                         NOT NULL REFERENCES chama(id),
    member_id       BIGINT                         NOT NULL REFERENCES member(id),
    amount          NUMERIC(12,2)                  NOT NULL,
    payment_method  payment_method,
    status          welfare_contribution_status    NOT NULL DEFAULT 'PENDING',
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ                    NOT NULL DEFAULT now()
);

CREATE INDEX idx_welfare_contribution_chama_id ON welfare_contribution(chama_id);
CREATE INDEX idx_welfare_contribution_member_id ON welfare_contribution(member_id);

-- An emergency payout disbursed from the fund, decided by the chairperson/treasurer. Kept
-- deliberately simple (amount + reason + who approved it), no scheduling/multi-step approval,
-- matching the scope of issue #65.
CREATE TABLE welfare_withdrawal (
    id                      BIGSERIAL       PRIMARY KEY,
    chama_id                BIGINT          NOT NULL REFERENCES chama(id),
    amount                  NUMERIC(12,2)   NOT NULL,
    reason                  TEXT            NOT NULL,
    disbursed_by_member_id  BIGINT          NOT NULL REFERENCES member(id),
    disbursed_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_welfare_withdrawal_chama_id ON welfare_withdrawal(chama_id);

-- Payment ledger gains a third nullable FK, mirroring contribution_id, so a welfare contribution
-- reuses the same idempotent M-Pesa/Flutterwave ledger row rather than a parallel integration.
ALTER TABLE payment ADD COLUMN welfare_contribution_id BIGINT REFERENCES welfare_contribution(id);
CREATE INDEX idx_payment_welfare_contribution_id ON payment(welfare_contribution_id);
