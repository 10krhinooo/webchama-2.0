-- Optional lifetime savings goal a chairperson can set for their chama. Null
-- means no goal is set, distinct from a goal of zero.
ALTER TABLE chama ADD COLUMN savings_target NUMERIC;
