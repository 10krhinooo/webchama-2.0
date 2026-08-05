-- Adds the maker-checker dual sign-off events (issue #52) to the existing activity_event_type
-- enum alongside the five event types V15 created it with.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'APPROVAL_APPROVED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'APPROVAL_REJECTED';
