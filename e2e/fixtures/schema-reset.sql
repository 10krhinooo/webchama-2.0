-- Empties every application table before the fixture is applied.
--
-- The table list is generated rather than hand-maintained, so a migration that adds a table does
-- not silently leave stale rows behind for the next run to trip over. flyway_schema_history is
-- excluded because the schema itself must survive; only the data is discarded.
--
-- RESTART IDENTITY is what lets the fixture insert literal ids and have them mean the same thing
-- on every run, so a spec can navigate straight to /chamas/4/loans without discovering the id
-- first. CASCADE handles the foreign keys rather than requiring the list to be in dependency
-- order.
DO $$
DECLARE
    tables text;
BEGIN
    SELECT string_agg(format('%I', tablename), ', ')
      INTO tables
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> 'flyway_schema_history';

    IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
    END IF;
END $$;
