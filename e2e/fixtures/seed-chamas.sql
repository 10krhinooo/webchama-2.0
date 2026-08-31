-- Deterministic fixture for the end-to-end suite.
--
-- Three properties make this usable as a fixture rather than demo data:
--
--   1. Literal ids. Every row states its own id, so a spec can navigate straight to
--      /chamas/4/loans instead of discovering the id first. db/dev-data/V900__seed_demo_data.sql
--      cannot be reused for this because it randomises values.
--
--   2. Dates relative to an anchor. Every date derives from date_trunc('month', CURRENT_DATE),
--      never a hard-coded literal, so "last month's contribution is overdue" is still true next
--      year.
--
--   3. One chama per spec file. Nothing is shared between mutating specs, which is what removes
--      the need to reset between them and lets the whole reset happen once in globalSetup.
--
-- Members are not inserted here. Their phone and national_id columns are stored as ciphertext,
-- so those rows are written by support/db.ts with the encryption applied in flight.

-- ---------------------------------------------------------------------------------------------
-- Chamas. 1 and 2 are read-only: 1 is fully populated for dashboard and analytics assertions,
-- 2 exists purely as the forbidden target in the tenant isolation spec. 3 upward are each owned
-- by a single spec file.
-- ---------------------------------------------------------------------------------------------
INSERT INTO chama (id, name, description, type, currency, contribution_frequency, contribution_amount,
                   meeting_day, status, created_at, approval_threshold, savings_target,
                   auto_push_enabled, auto_push_retry_hours, join_code)
VALUES
  (1, 'Umoja Savings',    'Fully populated, read only',       'TABLE_BANKING',   'KES', 'MONTHLY', 5000,  'SATURDAY', 'ACTIVE', now() - interval '18 months', 50000, 500000, false, 24, 'UMOJA1'),
  (2, 'Kilele Investors', 'Second tenant, isolation checks',  'INVESTMENT_GROUP','KES', 'MONTHLY', 8000,  'SUNDAY',   'ACTIVE', now() - interval '12 months', 50000, 800000, false, 24, 'KILELE'),
  (3, 'Tumaini Circle',   'Owned by the members spec',        'MERRY_GO_ROUND',  'KES', 'MONTHLY', 3000,  'FRIDAY',   'ACTIVE', now() - interval '6 months',  50000, 200000, false, 24, 'TUMAIN'),
  (4, 'Nuru Group',       'Owned by the loans spec',          'TABLE_BANKING',   'KES', 'MONTHLY', 4000,  'MONDAY',   'ACTIVE', now() - interval '9 months',  50000, 300000, false, 24, 'NURUGP'),
  (5, 'Baraka Fund',      'Owned by the penalties spec',      'TABLE_BANKING',   'KES', 'MONTHLY', 2500,  'TUESDAY',  'ACTIVE', now() - interval '7 months',  50000, 150000, false, 24, 'BARAKA'),
  (6, 'Imani Sacco',      'Owned by the contributions spec',  'TABLE_BANKING',   'KES', 'MONTHLY', 5000,  'THURSDAY', 'ACTIVE', now() - interval '8 months',  50000, 400000, false, 24, 'IMANIS'),
  (7, 'Pamoja Rotation',  'Owned by the payouts spec',        'MERRY_GO_ROUND',  'KES', 'MONTHLY', 6000,  'WEDNESDAY','ACTIVE', now() - interval '10 months', 10000, 600000, false, 24, 'PAMOJA'),
  (8, 'Salama Welfare',   'Owned by the welfare spec',        'TABLE_BANKING',   'KES', 'MONTHLY', 3500,  'SATURDAY', 'ACTIVE', now() - interval '5 months',  10000, 250000, false, 24, 'SALAMA'),
  (9, 'Faraja Assembly',  'Owned by the meetings spec',       'TABLE_BANKING',   'KES', 'MONTHLY', 4500,  'SUNDAY',   'ACTIVE', now() - interval '11 months', 50000, 350000, false, 24, 'FARAJA'),
  (10,'Neema Council',    'Owned by the resolutions spec',    'TABLE_BANKING',   'KES', 'MONTHLY', 4000,  'FRIDAY',   'ACTIVE', now() - interval '4 months',  50000, 300000, false, 24, 'NEEMAC'),
  (11,'Mwanzo Registry',  'Owned by the documents spec',      'TABLE_BANKING',   'KES', 'MONTHLY', 5500,  'MONDAY',   'ACTIVE', now() - interval '13 months', 50000, 450000, false, 24, 'MWANZO'),
  (12,'Hazina Trust',     'Owned by the dual sign-off spec',   'TABLE_BANKING',   'KES', 'MONTHLY', 4000,  'THURSDAY', 'ACTIVE', now() - interval '14 months', 50000, 400000, false, 24, 'HAZINA');

SELECT setval('chama_id_seq', 100, false);

