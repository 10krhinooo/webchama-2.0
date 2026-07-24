-- Loan rejection (issue #25): a REQUESTED loan can be rejected by CHAIRPERSON/TREASURER, not
-- just approved, giving loan review a real terminal "no" alongside "yes".
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'LOAN_REJECTED';
