# 🔒 Güvenlik Talimatları / Security Instructions

## ⚠️ ÖNEMLİ UYARILAR

### 1. GitHub Repository Ayarları
- ✅ **Repository'yi PRIVATE yapın**
  - GitHub → Settings → Change visibility → Make private
- ❌ **ASLA public repository'de hassas bilgi paylaşmayın**

### 2. Environment Variables (.env.local)
```bash
# .env.local dosyası ZATENi .gitignore'da - GIT'e GİTMEZ
# Bu dosyayı ASLA commit etmeyin!
```

**Kurulum:**
1. `.env.local.example` dosyasını kopyalayın
2. `.env.local` olarak yeniden adlandırın
3. İçindeki şifreleri DEĞİŞTİRİN
4. Production'da gerçek authentication kullanın (AD, OAuth, JWT)

### 3. Hassas Dosyalar - Kontrol Listesi
✅ Aşağıdaki dosyalar .gitignore'da olmalı:
- `.env.local`
- `.env.production`
- `*.pem`
- `*.key`
- `.DS_Store`
- `node_modules/`

### 4. Kod İçinde ASLA:
❌ Hardcoded passwords
❌ API keys
❌ Database connection strings
❌ Private keys
❌ Credentials

✅ Bunun yerine:
- Environment variables kullanın
- Secret management tools (AWS Secrets Manager, Azure Key Vault)
- .env dosyaları (gitignore'da)

### 5. Production Deployment
**⚠️ Demo passwords'leri production'da KULLANMAYIN!**

Gerçek authentication için:
- Azure Active Directory (AD) entegrasyonu
- OAuth 2.0 / OIDC
- JWT tokens
- SSO (Single Sign-On)

### 6. Git History Temizleme (Eğer hassas veri commit edilmişse)
```bash
# Tüm history'den bir dosyayı sil
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/sensitive/file" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DİKKAT: Tehlikeli)
git push origin --force --all
```

### 7. Kontrol Komutu
```bash
# Git'e gidecek dosyaları kontrol et
git status

# Staged files'ı kontrol et
git diff --staged

# .env.local'in ignore edildiğini doğrula
git check-ignore .env.local
# Output: .env.local (ignore ediliyor demek)
```

---

## 📋 Güvenlik Checklist

- [ ] Repository PRIVATE
- [ ] `.env.local` dosyası oluşturuldu ve şifreler güncellendi
- [ ] `.env.local` Git'e commit edilmedi
- [ ] Hardcoded passwords kod dışına çıkarıldı
- [ ] Production'da gerçek auth kullanılacak
- [ ] Team'e güvenlik talimatları paylaşıldı
- [ ] Git history temizlendi (gerekiyorsa)

---

## 🚨 Acil Durum

Eğer yanlışlıkla hassas veri GitHub'a gittiyse:
1. **Hemen şifreleri değiştirin**
2. Git history'yi temizleyin
3. Repository'yi geçici olarak private yapın
4. Güvenlik ekibini bilgilendirin

---

**Son Güncelleme:** 12 Şubat 2026
**Hazırlayan:** GitHub Copilot
