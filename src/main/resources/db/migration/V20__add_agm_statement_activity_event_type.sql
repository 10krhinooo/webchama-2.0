-- Adds the AGM_STATEMENT_GENERATED activity event type (issue #66), logged whenever a one-click
-- AGM/auditor annual financial statement is generated for a chama. Same "extend the existing enum"
-- pattern as V16__add_agm_statement_document_type.sql for document_type.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'AGM_STATEMENT_GENERATED';
