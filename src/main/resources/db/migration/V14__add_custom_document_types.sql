-- Adds the two freeform document types (issue #106) used by the document generator wizard
-- (issue #43) to produce an ad-hoc invoice/receipt for any chama member, alongside the existing
-- three record-derived types (contribution receipt, loan statement, payout receipt).
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'CUSTOM_INVOICE';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'CUSTOM_RECEIPT';
