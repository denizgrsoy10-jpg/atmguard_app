-- ════════════════════════════════════════════════════════════════════════
--  FEED: gunson_batch  →  POST /api/v1/gunson  (payload: kayitlar)
--  Sıklık: her gece 03:00 (:gun = bugünün tarihi YYYY-MM-DD)
--
--  Beyin şu kolonları bekler:
--    terminal_id        : ATM no                 (ZORUNLU)
--    tarih              : günsonu tarihi (YYYY-MM-DD)
--    sifirlama_yapildi  : kaset sıfırlama oldu mu (0/1 → bool)
--    ikmal_tutar        : gün içi ikmal tutarı
--    toplama_tutar      : gün içi para toplama tutarı
--    toplam_cekim       : toplam çekim
--    toplam_yatirma     : toplam yatırma
--
--  Bu feed çağrılınca beyin arka planda kendini günceller (incremental).
--  :gun → runner tarafından otomatik geçilir.
-- ════════════════════════════════════════════════════════════════════════
SELECT
    terminal_id        AS terminal_id,
    tarih              AS tarih,
    sifirlama_yapildi  AS sifirlama_yapildi,
    ikmal_tutar        AS ikmal_tutar,
    toplama_tutar      AS toplama_tutar,
    toplam_cekim       AS toplam_cekim,
    toplam_yatirma     AS toplam_yatirma
FROM gunson_kayit
WHERE tarih = :gun;
