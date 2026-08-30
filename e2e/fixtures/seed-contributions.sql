-- Applied after members, which support/db.ts inserts with their PII encrypted in flight.

-- ---------------------------------------------------------------------------------------------
-- Contributions for chama 1, one cycle per month over the last six. The two most recent are left
-- unpaid so the dashboard has arrears to show and the member has something to pay.
-- ---------------------------------------------------------------------------------------------
INSERT INTO contribution (id, chama_id, member_id, period, amount_due, amount_paid, payment_method, status, paid_at, version)
SELECT
    (row_number() OVER (ORDER BY m.id, g.offset_months))::bigint,
    1,
    m.id,
    (date_trunc('month', CURRENT_DATE) - (g.offset_months || ' months')::interval)::date,
    5000,
    CASE WHEN g.offset_months >= 2 THEN 5000 ELSE 0 END,
    CASE WHEN g.offset_months >= 2 THEN 'CASH'::payment_method ELSE NULL END,
    CASE WHEN g.offset_months >= 2 THEN 'PAID'::contribution_status ELSE 'PENDING'::contribution_status END,
    CASE WHEN g.offset_months >= 2 THEN now() - (g.offset_months || ' months')::interval ELSE NULL END,
    0
FROM member m
CROSS JOIN generate_series(0, 5) AS g(offset_months)
WHERE m.chama_id = 1;

SELECT setval('contribution_id_seq', 1000, false);

-- ---------------------------------------------------------------------------------------------
-- Chama 6, owned by the contribution payment specs. One unpaid cycle per member, priced to match
-- the amount the Flutterwave verify stub reports, since that path rejects a mismatch by design.
-- ---------------------------------------------------------------------------------------------
INSERT INTO contribution (id, chama_id, member_id, period, amount_due, amount_paid, payment_method, status, paid_at, version)
VALUES
  (101, 6, 5, date_trunc('month', CURRENT_DATE)::date, 5000, 0, NULL, 'PENDING', NULL, 0),
  (102, 6, 6, date_trunc('month', CURRENT_DATE)::date, 5000, 0, NULL, 'PENDING', NULL, 0),
  (103, 6, 7, date_trunc('month', CURRENT_DATE)::date, 5000, 0, NULL, 'PENDING', NULL, 0);
