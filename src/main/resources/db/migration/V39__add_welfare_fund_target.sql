-- Optional goal amount for a chama's welfare fund, editable by the chairperson, mirroring
-- chama.savings_target (issue #179). Nullable since not every chama sets one.
ALTER TABLE welfare_fund ADD COLUMN target NUMERIC;
