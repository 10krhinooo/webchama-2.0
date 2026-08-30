-- Separate database for the end-to-end suite, kept apart from both `chama` (local dev data) and
-- `chama_test` (wiped table-by-table in @BeforeEach by @QuarkusTest). The e2e fixture truncates
-- and reseeds the whole schema in globalSetup, so it must never share a database with anything
-- a developer cares about.
--
-- Like 01-create-test-db.sql, this only runs on the first initialisation of a fresh Postgres
-- volume. On an existing volume, create it by hand:
--   docker exec -it webchama-postgres psql -U chama -d chama -c 'CREATE DATABASE chama_e2e OWNER chama;'
CREATE DATABASE chama_e2e OWNER chama;
