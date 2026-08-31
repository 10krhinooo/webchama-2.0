-- A chama had a name, a description and its money settings, and no identity beyond that. These are
-- what a receipt needs in its letterhead, and what makes a generated document look like it came
-- from the chama rather than from the software.
--
-- All nullable: every existing chama predates them, and plenty of real chamas have no postal
-- address or registration number at all.
ALTER TABLE chama
    ADD COLUMN postal_address      VARCHAR(255),
    ADD COLUMN physical_address    VARCHAR(255),
    ADD COLUMN contact_phone       VARCHAR(32),
    ADD COLUMN contact_email       VARCHAR(255),
    ADD COLUMN registration_number VARCHAR(64);

-- The logo lives beside the row rather than in object storage: there is none configured, and
-- generated PDFs are already stored as bytes in this database. Capped in the resource at 256KB,
-- which is far more than a letterhead mark needs.
ALTER TABLE chama
    ADD COLUMN logo_bytes        BYTEA,
    ADD COLUMN logo_content_type VARCHAR(64);
