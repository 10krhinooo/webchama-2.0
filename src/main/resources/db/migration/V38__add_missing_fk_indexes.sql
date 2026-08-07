-- AUDIT_PLAN.md P3: payment.member_id/status (the highest-growth ledger table, and now scanned
-- every 5 minutes by PaymentService.reconcileStalePendingMpesaPayments) and a handful of nullable
-- FK columns (loan approver, penalty decider, approval requester/approvers, meeting attendee) had
-- no index at all.
CREATE INDEX idx_payment_member_id ON payment(member_id);
CREATE INDEX idx_payment_status ON payment(status);

CREATE INDEX idx_loan_approved_by_member_id ON loan(approved_by_member_id);

CREATE INDEX idx_penalty_decided_by_member_id ON penalty(decided_by_member_id);

CREATE INDEX idx_approval_requested_by ON approval(requested_by_id);
CREATE INDEX idx_approval_first_approver ON approval(first_approver_id);
CREATE INDEX idx_approval_second_approver ON approval(second_approver_id);

CREATE INDEX idx_meeting_attendance_member_id ON meeting_attendance(member_id);
