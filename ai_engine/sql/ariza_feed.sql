-- ════════════════════════════════════════════════════════════════════════
--  FEED: ariza_feed  →  POST /api/v1/ariza-feed  (payload: olaylar)
--  Sıklık: 15 dk'da bir (örtüşmeli pencere — :since = şimdi - 20 dk)
--
--  Beyin şu kolonları bekler:
--    terminal_id : ATM no            (ZORUNLU)
--    tarih       : olay zamanı ISO   ('2026-02-22T14:30:00')
--    ariza_kodu  : arıza/hata kodu    (FLM/SLM sınıflaması bunu kullanır)
--    aciklama    : serbest açıklama
--    durum       : 'ACIK' / 'KAPALI' / 'DEVAM_EDIYOR'
--    sure_dk     : açık kalma süresi (dk, int)
--
--  :since  → runner tarafından otomatik geçilir (son N dk penceresi).
--  NOT (BANKA): tarih kolonunuz string ISO değilse, karşılaştırma için
--               kendi tip dönüşümünüzü uygulayın (ör. TO_DATE/CONVERT).
-- ════════════════════════════════════════════════════════════════════════
SELECT
    terminal_id  AS terminal_id,
    tarih        AS tarih,
    ariza_kodu   AS ariza_kodu,
    aciklama     AS aciklama,
    durum        AS durum,
    sure_dk      AS sure_dk
FROM ariza_kayit
WHERE tarih >= :since
ORDER BY tarih;
