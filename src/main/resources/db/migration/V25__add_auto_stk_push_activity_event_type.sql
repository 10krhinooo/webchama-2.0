-- Adds the auto-STK-push scheduler event (issue #60) to the existing activity_event_type enum
-- created in V15 and previously extended in V18.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'AUTO_STK_PUSH_SENT';
