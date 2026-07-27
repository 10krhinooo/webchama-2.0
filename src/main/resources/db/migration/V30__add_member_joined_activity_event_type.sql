-- Adds the self-service join-via-code event (issue #170) to the existing activity_event_type
-- enum created in V15 and previously extended in V18 and V25.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'MEMBER_JOINED';
