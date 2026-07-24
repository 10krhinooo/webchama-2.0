ALTER TABLE member ADD COLUMN auto_pay_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE contribution ADD COLUMN last_auto_push_at TIMESTAMPTZ;

CREATE INDEX idx_member_auto_pay_enabled ON member(auto_pay_enabled);
