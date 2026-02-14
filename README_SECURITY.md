# 🔐 Hızlı Başlangıç - Güvenlik Kurulumu

## 1. Repository'yi Private Yap
GitHub'da:
```
Settings → Change repository visibility → Make private
```

## 2. Environment Dosyasını Kur
```bash
# Proje klasöründe:
cp .env.local.example .env.local

# Şifreleri değiştir:
nano .env.local  # veya VS Code ile aç
```

## 3. Şifreleri Güncelle
`.env.local` dosyasını aç ve değiştir:
```bash
NEXT_PUBLIC_DEMO_ADMIN_PASSWORD=SİZİN_GÜVENLİ_ŞİFRENİZ
NEXT_PUBLIC_DEMO_MANAGER_PASSWORD=SİZİN_GÜVENLİ_ŞİFRENİZ
# ... diğerleri
```

## 4. Git Kontrolü
```bash
# .env.local'in ignore edildiğini doğrula:
git check-ignore .env.local
# Output: .env.local ✅

# Eğer output yoksa, .gitignore'a ekle:
echo ".env.local" >> .gitignore
```

## 5. Commit Etme
```bash
# ✅ DOĞRU:
git add src/
git add .env.local.example  # Template'i commit et
git commit -m "Security: Moved passwords to env vars"

# ❌ YANLIŞ:
git add .env.local  # BUNU YAPMA!
```

## 6. Production İçin
Demo şifreleri **sadece development için**!

Production'da:
- Azure Active Directory
- OAuth 2.0
- JWT authentication
kullanın.

---

**✅ Artık güvendesiniz!**

Detaylar için: `SECURITY.md`
