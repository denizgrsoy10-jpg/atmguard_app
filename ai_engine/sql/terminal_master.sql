-- ════════════════════════════════════════════════════════════════════════
--  FEED: terminal_master  →  POST /api/v1/terminal-tanim  (payload: terminaller)
--  Sıklık: günde 1 kez (sabah 06:00)
--
--  Beyin şu kolonları bekler (alias ile bu adlara çevirin):
--    terminal_id        : ATM benzersiz no   (ZORUNLU)
--    atm_adi            : ATM adı / lokasyon adı
--    zone               : bölge no (int)
--    konum_tipi         : 'Branch' / 'Offsite' / vb.
--    sube_personel_var  : şubede personel var mı (0/1 → bool)
--    nakit_merkezi      : bağlı CIT / nakit merkezi
--
--  NOT (BANKA): Aşağıdaki tablo/kolon adlarını kendi şemanızla değiştirin.
--               SELECT'in DÖNDÜRDÜĞÜ kolon adları yukarıdakilerle aynı olmalı.
-- ════════════════════════════════════════════════════════════════════════
SELECT
    terminal_id        AS terminal_id,
    atm_adi            AS atm_adi,
    zone               AS zone,
    konum_tipi         AS konum_tipi,
    sube_personel_var  AS sube_personel_var,
    nakit_merkezi      AS nakit_merkezi
FROM atm_terminal;
