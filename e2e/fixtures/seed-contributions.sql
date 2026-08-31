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

-- ---------------------------------------------------------------------------------------------
-- Chama 3, owned by the members spec. One settled contribution against Daniel, so the spec has a
-- member whose removal must be refused in favour of exiting them: deleting someone with financial
-- history would cascade the record away.
-- ---------------------------------------------------------------------------------------------
INSERT INTO contribution (id, chama_id, member_id, period, amount_due, amount_paid, payment_method, status, paid_at, version)
VALUES
  (201, 3, 10, (date_trunc('month', CURRENT_DATE) - interval '1 month')::date, 3000, 3000, 'CASH', 'PAID', now() - interval '1 month', 0);

-- ---------------------------------------------------------------------------------------------
-- Chama 11, owned by the documents spec. One settled contribution per member, so a member has
-- something of their own to produce a receipt for.
-- ---------------------------------------------------------------------------------------------
INSERT INTO contribution (id, chama_id, member_id, period, amount_due, amount_paid, payment_method, status, paid_at, version)
VALUES
  (301, 11, 28, (date_trunc('month', CURRENT_DATE) - interval '1 month')::date, 5500, 5500, 'CASH', 'PAID', now() - interval '1 month', 0),
  (302, 11, 30, (date_trunc('month', CURRENT_DATE) - interval '1 month')::date, 5500, 5500, 'CASH', 'PAID', now() - interval '1 month', 0);
