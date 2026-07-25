-- Dev-only demo data for the SUPER_ADMIN platform overview KPIs (PlatformOverviewDto). This
-- location is only wired into Flyway's search path for the dev profile (see
-- %dev.quarkus.flyway.locations in application.properties), so it never runs against a real
-- deployment. Guarded so re-running quarkus:dev against a database that already has this data
-- (or a developer's own real chamas past 10 rows) doesn't keep piling up more.
DO $$
DECLARE
    chama_names TEXT[] := ARRAY[
        'Umoja Savings Circle', 'Jumuiya Investment Group', 'Baraka Table Bank',
        'Nyota Merry-Go-Round', 'Tumaini Welfare Chama', 'Amani Women Group',
        'Harambee Traders Sacco', 'Furaha Family Fund', 'Imani Youth Chama',
        'Ushirika Building Group', 'Msingi Land Buyers', 'Neema Boda Riders',
        'Upendo Market Women', 'Kilele Business Circle', 'Zawadi Savers',
        'Mwangaza Farmers Group', 'Salama Estate Chama', 'Baraka Mums Chama',
        'Vision Youth Sacco', 'Pamoja Civil Servants'
    ];
    first_names TEXT[] := ARRAY['James','Mary','John','Grace','Peter','Faith','David','Ann','Michael','Joyce',
        'Samuel','Esther','Daniel','Lucy','Joseph','Beatrice','Paul','Rose','Stephen','Alice',
        'George','Nancy','Francis','Mercy','Charles','Purity','Kevin','Winnie','Brian','Caroline'];
    last_names TEXT[] := ARRAY['Mwangi','Otieno','Wanjiru','Kamau','Achieng','Njoroge','Wafula','Muthoni',
        'Kariuki','Adhiambo','Kiptoo','Nyambura','Ochieng','Chebet','Maina','Akinyi','Kipchoge','Waweru'];
    v_chama_id BIGINT;
    v_member_id BIGINT;
    v_contribution_id BIGINT;
    chama_types chama_type[] := ARRAY['MERRY_GO_ROUND','TABLE_BANKING','INVESTMENT_GROUP']::chama_type[];
    frequencies contribution_frequency[] := ARRAY['WEEKLY','MONTHLY']::contribution_frequency[];
    n_members INT;
    member_count INT;
    period_offset INT;
    period_date DATE;
    amt_due NUMERIC;
    amt_paid NUMERIC;
    c_status contribution_status;
    p_method payment_method;
    pay_status payment_status;
    roll INT;
    v_full_name TEXT;
BEGIN
    IF (SELECT count(*) FROM chama) >= 10 THEN
        RAISE NOTICE 'Skipping demo data seed: chama table already has 10+ rows';
        RETURN;
    END IF;

    FOR i IN 1..array_length(chama_names, 1) LOOP
        INSERT INTO chama (name, description, type, currency, contribution_frequency,
                            contribution_amount, meeting_day, status, created_at, approval_threshold, savings_target)
        VALUES (
            chama_names[i],
            'Demo chama seeded for KPI showcase.',
            chama_types[1 + floor(random() * 3)::int],
            'KES',
            frequencies[1 + floor(random() * 2)::int],
            (round((500 + random() * 4500) / 50) * 50)::numeric(12,2),
            (ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[1 + floor(random()*6)::int],
            CASE WHEN random() < 0.85 THEN 'ACTIVE' ELSE 'INACTIVE' END::chama_status,
            now() - (floor(random() * 200) || ' days')::interval
              - CASE WHEN i <= 3 THEN (floor(random() * 15) || ' days')::interval ELSE '0 days'::interval END,
            (500 + random() * 4000)::numeric(12,2),
            (10000 + random() * 490000)::numeric(12,2)
        )
        RETURNING id INTO v_chama_id;

        -- Force a few chamas into "created this month" for the newChamasThisMonth KPI.
        IF i <= 3 THEN
            UPDATE chama SET created_at = date_trunc('month', now()) + (floor(random() * 20) || ' days')::interval
            WHERE id = v_chama_id;
        END IF;

        n_members := 6 + floor(random() * 10)::int;
        member_count := 0;

        FOR j IN 1..n_members LOOP
            v_full_name := first_names[1 + floor(random() * array_length(first_names,1))::int]
                || ' ' || last_names[1 + floor(random() * array_length(last_names,1))::int];

            INSERT INTO member (chama_id, keycloak_user_id, full_name, phone, national_id,
                                 next_of_kin, join_date, status, auto_pay_enabled)
            VALUES (
                v_chama_id,
                'demo-' || gen_random_uuid(),
                v_full_name,
                '+2547' || lpad((10000000 + floor(random() * 89999999))::text, 8, '0'),
                lpad((20000000 + floor(random() * 19999999))::text, 8, '0'),
                first_names[1 + floor(random() * array_length(first_names,1))::int] || ' ' ||
                    last_names[1 + floor(random() * array_length(last_names,1))::int],
                CURRENT_DATE - (floor(random() * 500) || ' days')::interval,
                CASE WHEN random() < 0.85 THEN 'ACTIVE' WHEN random() < 0.5 THEN 'SUSPENDED' ELSE 'EXITED' END::member_status,
                random() < 0.4
            )
            RETURNING id INTO v_member_id;

            member_count := member_count + 1;

            IF member_count = 1 THEN
                INSERT INTO member_role (member_id, role) VALUES (v_member_id, 'CHAIRPERSON');
            ELSIF member_count = 2 THEN
                INSERT INTO member_role (member_id, role) VALUES (v_member_id, 'TREASURER');
            ELSIF member_count = 3 THEN
                INSERT INTO member_role (member_id, role) VALUES (v_member_id, 'SECRETARY');
            ELSE
                INSERT INTO member_role (member_id, role) VALUES (v_member_id, 'MEMBER');
            END IF;

            -- Contribution history: last 6 periods (months) per member.
            FOR period_offset IN 0..5 LOOP
                period_date := date_trunc('month', now())::date - (period_offset || ' months')::interval;
                amt_due := (500 + random() * 4500)::numeric(12,2);

                roll := floor(random() * 100)::int;
                IF period_offset = 0 AND roll < 40 THEN
                    c_status := 'PENDING'; amt_paid := 0;
                ELSIF roll < 60 THEN
                    c_status := 'PAID'; amt_paid := amt_due;
                ELSIF roll < 80 THEN
                    c_status := 'PARTIAL'; amt_paid := round((amt_due * (0.2 + random() * 0.6))::numeric, 2);
                ELSIF roll < 95 THEN
                    c_status := 'OVERDUE'; amt_paid := 0;
                ELSE
                    c_status := 'PAID'; amt_paid := amt_due;
                END IF;

                p_method := (ARRAY['MPESA','CARD','CASH','BANK'])[1 + floor(random()*4)::int]::payment_method;

                INSERT INTO contribution (chama_id, member_id, period, amount_due, amount_paid,
                                           payment_method, status, paid_at)
                VALUES (
                    v_chama_id, v_member_id, period_date, amt_due, amt_paid,
                    CASE WHEN amt_paid > 0 THEN p_method ELSE NULL END,
                    c_status,
                    CASE WHEN amt_paid > 0
                         THEN (period_date + (floor(random() * 20) || ' days')::interval)
                         ELSE NULL END
                )
                RETURNING id INTO v_contribution_id;

                IF amt_paid > 0 AND p_method IN ('MPESA', 'CARD') THEN
                    pay_status := CASE WHEN random() < 0.9 THEN 'SUCCESS' ELSE 'FAILED' END::payment_status;
                    INSERT INTO payment (chama_id, member_id, contribution_id, purpose, amount, method,
                                          status, provider_reference, mpesa_receipt_number, paid_at, created_at)
                    VALUES (
                        v_chama_id, v_member_id, v_contribution_id, 'CONTRIBUTION',
                        CASE WHEN pay_status = 'SUCCESS' THEN amt_paid ELSE amt_due END,
                        p_method, pay_status,
                        'DEMO-' || upper(substr(md5(random()::text), 1, 12)),
                        CASE WHEN p_method = 'MPESA' AND pay_status = 'SUCCESS'
                             THEN upper(substr(md5(random()::text), 1, 10)) ELSE NULL END,
                        CASE WHEN pay_status = 'SUCCESS' THEN period_date + (floor(random() * 20) || ' days')::interval ELSE NULL END,
                        period_date + (floor(random() * 20) || ' days')::interval
                    );
                END IF;

                -- A few extra failed MPESA/CARD attempts that never became a paid contribution.
                IF roll >= 95 AND random() < 0.6 THEN
                    INSERT INTO payment (chama_id, member_id, contribution_id, purpose, amount, method,
                                          status, provider_reference, paid_at, created_at)
                    VALUES (
                        v_chama_id, v_member_id, v_contribution_id, 'CONTRIBUTION', amt_due,
                        (ARRAY['MPESA','CARD'])[1 + floor(random()*2)::int]::payment_method,
                        'FAILED',
                        'DEMO-' || upper(substr(md5(random()::text), 1, 12)),
                        NULL,
                        period_date + (floor(random() * 20) || ' days')::interval
                    );
                END IF;
            END LOOP;

            -- Roughly a third of members have a loan.
            IF random() < 0.35 THEN
                DECLARE
                    v_status loan_status;
                    v_principal NUMERIC;
                BEGIN
                    v_principal := (5000 + random() * 95000)::numeric(12,2);
                    roll := floor(random() * 100)::int;
                    IF roll < 35 THEN
                        v_status := 'REPAYING';
                    ELSIF roll < 55 THEN
                        v_status := 'DISBURSED';
                    ELSIF roll < 75 THEN
                        v_status := 'CLOSED';
                    ELSIF roll < 90 THEN
                        v_status := 'APPROVED';
                    ELSIF roll < 97 THEN
                        v_status := 'REQUESTED';
                    ELSE
                        v_status := 'DEFAULTED';
                    END IF;

                    INSERT INTO loan (chama_id, member_id, principal, interest_rate, interest_method,
                                       term_months, status, approved_at, disbursed_at, requested_at)
                    VALUES (
                        v_chama_id, v_member_id, v_principal, (5 + random() * 10)::numeric(5,2),
                        CASE WHEN random() < 0.5 THEN 'FLAT' ELSE 'REDUCING_BALANCE' END::interest_method,
                        (3 + floor(random() * 10))::int,
                        v_status,
                        CASE WHEN v_status IN ('APPROVED','DISBURSED','REPAYING','CLOSED','DEFAULTED')
                             THEN now() - (floor(random() * 150) || ' days')::interval ELSE NULL END,
                        CASE WHEN v_status IN ('DISBURSED','REPAYING','CLOSED','DEFAULTED')
                             THEN now() - (floor(random() * 120) || ' days')::interval ELSE NULL END,
                        now() - (floor(random() * 180) || ' days')::interval
                    );
                END;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Demo data seed complete.';
END $$;
