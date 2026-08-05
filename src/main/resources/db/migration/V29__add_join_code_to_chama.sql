-- Short shareable code (issue #170) letting an already-registered user self-join an existing
-- chama, instead of only via chairperson-added-by-email or creating their own chama. Backfill
-- existing rows with a generated code before enforcing NOT NULL/UNIQUE, since the column can't
-- start out both non-null and unique with no values.
ALTER TABLE chama ADD COLUMN join_code VARCHAR(10);
UPDATE chama SET join_code = upper(substr(md5(random()::text || id), 1, 8)) WHERE join_code IS NULL;
ALTER TABLE chama ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE chama ADD CONSTRAINT chama_join_code_key UNIQUE (join_code);
