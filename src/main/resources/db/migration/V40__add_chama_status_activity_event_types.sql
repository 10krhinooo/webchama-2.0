-- Adds the automatic chama status sweep events (issue #179) to the existing activity_event_type
-- enum created in V15 and previously extended in V18, V20, V21, V23, V25, V30, and V34.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'CHAMA_MARKED_INACTIVE';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'CHAMA_REACTIVATED';
