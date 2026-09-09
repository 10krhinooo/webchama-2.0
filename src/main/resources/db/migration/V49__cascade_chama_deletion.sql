-- Let the database delete a chama's rows, instead of a hand-ordered list in Java.
--
-- ChamaService.delete carried an ordered sequence of fourteen bulk deletes, and every new
-- per-chama table had to be added to it and to the test cleaner or both would break. The system
-- review called it the most fragile invariant in the backend, and it had already drifted twice:
-- the comment in that method records activity_log being added after deleting a used chama failed,
-- and by now six more tables had gone missing the same way. approval, generated_document,
-- resolution, welfare_fund, welfare_contribution and welfare_withdrawal all reference chama with
-- no cascade and none of them were in the list, so deleting a chama that had ever recorded an
-- approval, produced a receipt, opened a resolution or run a welfare fund failed on a foreign key.
--
-- Two kinds of constraint are changed here, and only two.
--
-- First, every table that carries its own chama_id. Once these cascade, deleting the chama removes
-- them, and their other foreign keys can stay as they are: a NO ACTION constraint is checked at the
-- end of the statement, not per row, so contribution.member_id is satisfied when the cascade
-- removes the member and the contribution together. That is deliberate rather than incidental.
-- Those member-facing constraints are the second line of defence behind the EXITED soft-delete
-- rule in MemberService, which refuses to delete a member with financial history, and cascading
-- them would quietly remove the database's own half of that guarantee.
--
-- Second, the children that have no chama_id of their own and hang off a parent that does. The
-- cascade cannot reach them, so deleting the chama fails on their constraint instead. These are
-- ordinary composition: a repayment without its loan, or a vote without its resolution, is not a
-- row anyone would want kept.
--
-- Two of those children also point at member, and those constraints have to cascade as well. A
-- cascade that reaches a row through its parent does not satisfy a second constraint on the same
-- row: deleting the member still fails on meeting_attendance.member_id even though the attendance
-- is on its way out through the meeting. That is measurably different from the contribution case
-- above, where the cascade reaches the row from the chama directly, and it is the sort of thing
-- worth checking rather than reasoning about.
--
-- These two are safe to cascade for a reason worth stating: MemberService.hasHistory already
-- counts meeting_attendance and resolution_vote before allowing a member to be deleted at all, and
-- refuses in favour of MemberStatus.EXITED. The application guard is the one protecting attendance
-- and votes; the constraint was a second copy of it, and it was the copy blocking a legitimate
-- chama deletion.
--
-- Dropping and recreating is the only way to change a foreign key's delete rule in PostgreSQL;
-- there is no ALTER CONSTRAINT for it. Each pair below is one constraint, unchanged except for the
-- delete rule.

-- Tables owned directly by a chama.
ALTER TABLE activity_log DROP CONSTRAINT activity_log_chama_id_fkey;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE approval DROP CONSTRAINT approval_chama_id_fkey;
ALTER TABLE approval ADD CONSTRAINT approval_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE contribution DROP CONSTRAINT contribution_chama_id_fkey;
ALTER TABLE contribution ADD CONSTRAINT contribution_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE generated_document DROP CONSTRAINT generated_document_chama_id_fkey;
ALTER TABLE generated_document ADD CONSTRAINT generated_document_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE loan DROP CONSTRAINT loan_chama_id_fkey;
ALTER TABLE loan ADD CONSTRAINT loan_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE meeting DROP CONSTRAINT meeting_chama_id_fkey;
ALTER TABLE meeting ADD CONSTRAINT meeting_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE member DROP CONSTRAINT member_chama_id_fkey;
ALTER TABLE member ADD CONSTRAINT member_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE payment DROP CONSTRAINT payment_chama_id_fkey;
ALTER TABLE payment ADD CONSTRAINT payment_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE payout DROP CONSTRAINT payout_chama_id_fkey;
ALTER TABLE payout ADD CONSTRAINT payout_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE payout_schedule DROP CONSTRAINT payout_schedule_chama_id_fkey;
ALTER TABLE payout_schedule ADD CONSTRAINT payout_schedule_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE penalty DROP CONSTRAINT penalty_chama_id_fkey;
ALTER TABLE penalty ADD CONSTRAINT penalty_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE resolution DROP CONSTRAINT resolution_chama_id_fkey;
ALTER TABLE resolution ADD CONSTRAINT resolution_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE welfare_contribution DROP CONSTRAINT welfare_contribution_chama_id_fkey;
ALTER TABLE welfare_contribution ADD CONSTRAINT welfare_contribution_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE welfare_fund DROP CONSTRAINT welfare_fund_chama_id_fkey;
ALTER TABLE welfare_fund ADD CONSTRAINT welfare_fund_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

ALTER TABLE welfare_withdrawal DROP CONSTRAINT welfare_withdrawal_chama_id_fkey;
ALTER TABLE welfare_withdrawal ADD CONSTRAINT welfare_withdrawal_chama_id_fkey
    FOREIGN KEY (chama_id) REFERENCES chama(id) ON DELETE CASCADE;

-- Children with no chama_id, which the cascade above cannot reach on its own.
ALTER TABLE loan_disbursement DROP CONSTRAINT loan_disbursement_loan_id_fkey;
ALTER TABLE loan_disbursement ADD CONSTRAINT loan_disbursement_loan_id_fkey
    FOREIGN KEY (loan_id) REFERENCES loan(id) ON DELETE CASCADE;

ALTER TABLE loan_repayment DROP CONSTRAINT loan_repayment_loan_id_fkey;
ALTER TABLE loan_repayment ADD CONSTRAINT loan_repayment_loan_id_fkey
    FOREIGN KEY (loan_id) REFERENCES loan(id) ON DELETE CASCADE;

ALTER TABLE meeting_attendance DROP CONSTRAINT meeting_attendance_meeting_id_fkey;
ALTER TABLE meeting_attendance ADD CONSTRAINT meeting_attendance_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES meeting(id) ON DELETE CASCADE;

ALTER TABLE resolution_vote DROP CONSTRAINT resolution_vote_resolution_id_fkey;
ALTER TABLE resolution_vote ADD CONSTRAINT resolution_vote_resolution_id_fkey
    FOREIGN KEY (resolution_id) REFERENCES resolution(id) ON DELETE CASCADE;

-- Reachable only through a parent, and also pointing at member. See the note above on why these
-- two are safe: MemberService.hasHistory refuses to delete a member with either.
ALTER TABLE meeting_attendance DROP CONSTRAINT meeting_attendance_member_id_fkey;
ALTER TABLE meeting_attendance ADD CONSTRAINT meeting_attendance_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE;

ALTER TABLE resolution_vote DROP CONSTRAINT resolution_vote_member_id_fkey;
ALTER TABLE resolution_vote ADD CONSTRAINT resolution_vote_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE;
