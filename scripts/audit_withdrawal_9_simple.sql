-- Withdrawal #9 only — copy each block to phpMyAdmin and click Go

-- A) Who withdrew?
SELECT id, user_id AS withdrawer_id, amount_usd AS gross, fee_usd AS fee_pool, status
FROM withdrawals WHERE id = 9;

-- B) Paid team rewards (your screenshot)
SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.level')) AS UNSIGNED) AS level,
    user_id AS earner_id,
    amount_usd AS paid_usd
FROM ledger_entries
WHERE entry_type = 'affiliate_team_reward'
  AND reference_type = 'withdrawal'
  AND reference_id = 9
ORDER BY level;

-- C) Upline chain + gate (replace 131 with withdrawer_id from query A if different)
SELECT 1 AS level,
       u1.id AS upline_id, u1.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u1.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u1.id AND d.id_activated_at IS NOT NULL) >= 1 THEN 'OK' ELSE 'SKIP' END AS gate,
       25.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
WHERE c.id = 131;

SELECT 2 AS level, u2.id, u2.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u2.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u2.id AND d.id_activated_at IS NOT NULL) >= 2 THEN 'OK' ELSE 'SKIP' END AS gate,
       15.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
WHERE c.id = 131;

SELECT 3 AS level, u3.id, u3.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u3.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u3.id AND d.id_activated_at IS NOT NULL) >= 3 THEN 'OK' ELSE 'SKIP' END AS gate,
       12.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
WHERE c.id = 131;

SELECT 4 AS level, u4.id, u4.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u4.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u4.id AND d.id_activated_at IS NOT NULL) >= 4 THEN 'OK' ELSE 'SKIP' END AS gate,
       10.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
WHERE c.id = 131;

SELECT 5 AS level, u5.id, u5.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u5.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u5.id AND d.id_activated_at IS NOT NULL) >= 5 THEN 'OK' ELSE 'SKIP' END AS gate,
       9.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
LEFT JOIN users u5 ON u5.id = u4.referred_by
WHERE c.id = 131;

SELECT 6 AS level, u6.id, u6.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u6.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u6.id AND d.id_activated_at IS NOT NULL) >= 6 THEN 'OK' ELSE 'SKIP' END AS gate,
       8.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
LEFT JOIN users u5 ON u5.id = u4.referred_by
LEFT JOIN users u6 ON u6.id = u5.referred_by
WHERE c.id = 131;

SELECT 7 AS level, u7.id, u7.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u7.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u7.id AND d.id_activated_at IS NOT NULL) >= 7 THEN 'OK' ELSE 'SKIP' END AS gate,
       6.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
LEFT JOIN users u5 ON u5.id = u4.referred_by
LEFT JOIN users u6 ON u6.id = u5.referred_by
LEFT JOIN users u7 ON u7.id = u6.referred_by
WHERE c.id = 131;

SELECT 8 AS level, u8.id, u8.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u8.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u8.id AND d.id_activated_at IS NOT NULL) >= 8 THEN 'OK' ELSE 'SKIP' END AS gate,
       5.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
LEFT JOIN users u5 ON u5.id = u4.referred_by
LEFT JOIN users u6 ON u6.id = u5.referred_by
LEFT JOIN users u7 ON u7.id = u6.referred_by
LEFT JOIN users u8 ON u8.id = u7.referred_by
WHERE c.id = 131;

SELECT 9 AS level, u9.id, u9.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u9.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u9.id AND d.id_activated_at IS NOT NULL) >= 9 THEN 'OK' ELSE 'SKIP' END AS gate,
       5.00 AS expected_usd_if_ok
FROM users c
LEFT JOIN users u1 ON u1.id = c.referred_by
LEFT JOIN users u2 ON u2.id = u1.referred_by
LEFT JOIN users u3 ON u3.id = u2.referred_by
LEFT JOIN users u4 ON u4.id = u3.referred_by
LEFT JOIN users u5 ON u5.id = u4.referred_by
LEFT JOIN users u6 ON u6.id = u5.referred_by
LEFT JOIN users u7 ON u7.id = u6.referred_by
LEFT JOIN users u8 ON u8.id = u7.referred_by
LEFT JOIN users u9 ON u9.id = u8.referred_by
WHERE c.id = 131;

SELECT 10 AS level, u10.id, u10.name,
       (SELECT COUNT(*) FROM users d WHERE d.referred_by = u10.id AND d.id_activated_at IS NOT NULL) AS activated_directs,
       CASE WHEN (SELECT COUNT(*) FROM users d WHERE d.referred_by = u10.id AND d.id_activated_at IS NOT NULL) >= 10 THEN 'OK' ELSE 'SKIP' END AS gate,
       5.00 AS expected_usd_if_ok
FROM users c
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
WHERE c.id = 131;
