-- Adds the AGM/auditor annual financial statement document type (issue #66), a chama-wide
-- read-only aggregation across contributions/loans/payouts/penalties for a given period, alongside
-- the existing record-derived and freeform document types. Same "extend the existing enum" pattern
-- as V14__add_custom_document_types.sql.
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'AGM_STATEMENT';
