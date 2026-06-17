-- ════════════════════════════════════════════════════════════════════════
--  FEED: bakiye_feed  →  POST /api/v1/bakiye-feed  (payload: bakiyeler)
--  Sıklık: 15 dk'da bir (:since = şimdi - 20 dk)
--
--  Beyin şu kolonları bekler:
--    terminal_id    : ATM no              (ZORUNLU)
--    zaman          : ölçüm zamanı ISO
--    tl_bakiye      : toplam TL bakiye
--    kaset_1..4     : kaset bazında bakiye
--    recycle_bakiye : recycle kaset bakiyesi
--    yatan_para     : yatırılan (deposit) tutar
--
--  Boş / '-' değerler beyin tarafında 0 kabul edilir.
--  NOT (BANKA): kaset sayısı modele göre değişir; fazlası kaset_5..8 olarak
--               eklenebilir, beyin esnek kabul eder.
-- ════════════════════════════════════════════════════════════════════════
SELECT
    terminal_id     AS terminal_id,
    zaman           AS zaman,
    tl_bakiye       AS tl_bakiye,
    kaset_1         AS kaset_1,
    kaset_2         AS kaset_2,
    kaset_3         AS kaset_3,
    kaset_4         AS kaset_4,
    recycle_bakiye  AS recycle_bakiye,
    yatan_para      AS yatan_para
FROM atm_bakiye
WHERE zaman >= :since
ORDER BY zaman;
