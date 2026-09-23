-- Withdrawal Team Reward audit (L1-L10) for phpMyAdmin
-- Step 1: Run this line alone first, change 9 to your withdrawal id
SET @wid = 9;

-- Step 2: Withdrawal summary
SELECT id, user_id AS withdrawer_id, amount_usd AS gross, fee_usd AS fee_pool, net_usd, status
FROM withdrawals
WHERE id = @wid;

-- Step 3: What was actually paid (ledger)
SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.level')) AS UNSIGNED) AS level,
    user_id AS earner_id,
    amount_usd AS paid_usd
FROM ledger_entries
WHERE entry_type = 'affiliate_team_reward'
  AND reference_type = 'withdrawal'
  AND reference_id = @wid
ORDER BY level;

-- Step 4: Full L1-L10 audit (run AFTER Step 1; copy from SELECT below only)
SELECT
    lv.lvl AS network_level,
    up.upline_id,
    u.name AS upline_name,
    (
        SELECT COUNT(*)
        FROM users d
        WHERE d.referred_by = up.upline_id
          AND d.id_activated_at IS NOT NULL
    ) AS activated_directs,
    CASE
        WHEN up.upline_id IS NULL THEN 'NO UPLINE'
        WHEN lv.lvl = 1
             AND up.upline_id = (
                 SELECT referred_by FROM users
                 WHERE id = (SELECT user_id FROM withdrawals WHERE id = @wid LIMIT 1)
             ) THEN 'L1 direct sponsor'
        WHEN (
            SELECT COUNT(*)
            FROM users d
            WHERE d.referred_by = up.upline_id
              AND d.id_activated_at IS NOT NULL
        ) >= lv.lvl THEN 'GATE OK'
        ELSE 'SKIP low directs'
    END AS gate_status,
    ROUND(
        (SELECT fee_usd FROM withdrawals WHERE id = @wid LIMIT 1) * (
            CASE lv.lvl
                WHEN 1 THEN 0.25
                WHEN 2 THEN 0.15
                WHEN 3 THEN 0.12
                WHEN 4 THEN 0.10
                WHEN 5 THEN 0.09
                WHEN 6 THEN 0.08
                WHEN 7 THEN 0.06
                WHEN 8 THEN 0.05
                WHEN 9 THEN 0.05
                WHEN 10 THEN 0.05
                ELSE 0
            END
        ),
        2
    ) AS expected_if_gate_ok,
    le.amount_usd AS paid_usd,
    CASE WHEN le.id IS NULL THEN 'NOT PAID' ELSE 'PAID' END AS ledger_status
FROM (
    SELECT 1 AS lvl UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
    UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) lv
LEFT JOIN (
    SELECT 1 AS lvl, u1.id AS upline_id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by

    UNION ALL

    SELECT 2, u2.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by

    UNION ALL

    SELECT 3, u3.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by

    UNION ALL

    SELECT 4, u4.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by

    UNION ALL

    SELECT 5, u5.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by

    UNION ALL

    SELECT 6, u6.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by
    LEFT JOIN users u6 ON u6.id = u5.referred_by

    UNION ALL

    SELECT 7, u7.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by
    LEFT JOIN users u6 ON u6.id = u5.referred_by
    LEFT JOIN users u7 ON u7.id = u6.referred_by

    UNION ALL

    SELECT 8, u8.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by
    LEFT JOIN users u6 ON u6.id = u5.referred_by
    LEFT JOIN users u7 ON u7.id = u6.referred_by
    LEFT JOIN users u8 ON u8.id = u7.referred_by

    UNION ALL

    SELECT 9, u9.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by
    LEFT JOIN users u6 ON u6.id = u5.referred_by
    LEFT JOIN users u7 ON u7.id = u6.referred_by
    LEFT JOIN users u8 ON u8.id = u7.referred_by
    LEFT JOIN users u9 ON u9.id = u8.referred_by

    UNION ALL

    SELECT 10, u10.id
    FROM users c
    INNER JOIN withdrawals wd ON wd.user_id = c.id AND wd.id = @wid
    LEFT JOIN users u1 ON u1.id = c.referred_by
    LEFT JOIN users u2 ON u2.id = u1.referred_by
    LEFT JOIN users u3 ON u3.id = u2.referred_by
    LEFT JOIN users u4 ON u4.id = u3.referred_by
    LEFT JOIN users u5 ON u5.id = u4.referred_by
    LEFT JOIN users u6 ON u6.id = u5.referred_by
    LEFT JOIN users u7 ON u7.id = u6.referred_by
    LEFT JOIN users u8 ON u8.id = u7.referred_by
    LEFT JOIN users u9 ON u9.id = u8.referred_by
    LEFT JOIN users u10 ON u10.id = u9.referred_by
) up ON up.lvl = lv.lvl
LEFT JOIN users u ON u.id = up.upline_id
LEFT JOIN ledger_entries le
    ON le.entry_type = 'affiliate_team_reward'
   AND le.reference_type = 'withdrawal'
   AND le.reference_id = @wid
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(le.meta, '$.level')) AS UNSIGNED) = lv.lvl
ORDER BY lv.lvl;
