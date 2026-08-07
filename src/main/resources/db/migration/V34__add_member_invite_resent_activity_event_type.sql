-- Adds the resend-invite recovery path event (audit finding P1-11) to the existing
-- activity_event_type enum.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'MEMBER_INVITE_RESENT';
