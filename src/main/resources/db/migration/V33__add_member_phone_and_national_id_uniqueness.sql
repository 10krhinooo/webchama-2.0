-- Audit finding P1-8: no uniqueness on phone or national ID within a chama. Loan disbursement
-- targets member.phone directly, so two members sharing a phone number in the same chama is a
-- real duplicate-identity and misdirected-payout risk.
CREATE UNIQUE INDEX idx_member_chama_phone ON member(chama_id, phone);
CREATE UNIQUE INDEX idx_member_chama_national_id ON member(chama_id, national_id) WHERE national_id IS NOT NULL;
