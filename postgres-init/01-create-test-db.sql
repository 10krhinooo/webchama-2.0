-- Runs automatically the first time the postgres container initializes its data directory
-- (docker-entrypoint-initdb.d). Creates the isolated database @QuarkusTest classes point at via
-- the %test datasource override in application.properties. Tests wipe every table in
-- @BeforeEach, so they must never share a database with the dev server, or a test run wipes out
-- real local data.
CREATE DATABASE chama_test OWNER chama;
