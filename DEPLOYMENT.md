# QabulBot — Render.com Deployment Guide

## Talablar

- GitHub akkaunt (kod repo)
- Render.com akkaunt (bepul tier ishlaydi)
- PostgreSQL baza (Render Postgres yoki Supabase)
- Har bir klinika uchun alohida Telegram Bot tokeni (`@BotFather` orqali olinadi)
- Super admin uchun alohida bot tokeni

---

## 1. Telegram botlarini tayyorlash

### 1.1 Clinic botlari
Har bir klinika uchun `@BotFather` dan yangi bot yarating:
```
/newbot
```
Tokenni saqlang — keyinchalik klinika yaratishda ishlatiladi.

### 1.2 Super Admin boti
```
/newbot
```
Tokenni `SUPER_ADMIN_BOT_TOKEN` sifatida saqlang.

Super admin botiga mini app ulash:
```
/newapp → @YourSuperAdminBot → Web App URL: https://your-app.onrender.com/super-admin
```

---

## 2. Ma'lumotlar bazasini tayyorlash

### Render Postgres (tavsiya)
1. Render Dashboard → **New → PostgreSQL**
2. Name: `qabulbot-db`
3. Plan: Free
4. **Create Database** → **Internal Database URL** ni ko'chiring

### Supabase (alternativa)
1. app.supabase.com → yangi project
2. Settings → Database → Connection string (URI) ni oling

---

## 3. Render Web Service yaratish

1. Render Dashboard → **New → Web Service**
2. GitHub repo ulang
3. Sozlamalar:
   - **Name**: `qabulbot`
   - **Region**: Frankfurt (yoki Singapore)
   - **Branch**: `master`
   - **Root Directory**: `qabulbot`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`

---

## 4. Environment Variables (muhit o'zgaruvchilari)

Render → Service → **Environment** bo'limiga quyidagilarni qo'shing:

### Majburiy

| Kalit | Qiymat | Izoh |
|-------|--------|------|
| `NODE_ENV` | `production` | |
| `APP_URL` | `https://your-app.onrender.com` | Render bergan URL |
| `DB_HOST` | `dpg-xxx.oregon-postgres.render.com` | Render Postgres host |
| `DB_PORT` | `5432` | |
| `DB_USERNAME` | `qabulbot_user` | Render Postgres user |
| `DB_PASSWORD` | `xxx` | Render Postgres password |
| `DB_NAME` | `qabulbot` | Render Postgres DB name |
| `DB_SSL` | `true` | Render Postgres SSL talab qiladi |

### Super Admin

| Kalit | Qiymat |
|-------|--------|
| `SUPER_ADMIN_BOT_TOKEN` | `1234567890:AAF...` — **MAXFIY!** |
| `SUPER_ADMIN_IDS` | `123456789,987654321` — super admin Telegram ID lari (vergul bilan) |
| `SUPER_ADMIN_MINI_APP_URL` | `https://your-app.onrender.com/super-admin` |

### To'lov

| Kalit | Qiymat |
|-------|--------|
| `PAYMENT_CARD_NUMBER` | `8600 1234 5678 9012` |
| `PAYMENT_CARD_OWNER` | `ABDULLAYEV JASUR` |

### Birinchi klinika uchun (ixtiyoriy — seed uchun)

| Kalit | Qiymat |
|-------|--------|
| `BOT_TOKEN` | Birinchi klinika bot tokeni (agar seed kerak bo'lsa) |
| `ADMIN_IDS` | `123456789` — birinchi klinika admin ID |
| `CLINIC_NAME` | `Smile Dental` |

> **Eslatma:** Agar klinikalar allaqachon ma'lumotlar bazasida bo'lsa, `BOT_TOKEN`, `ADMIN_IDS`, `CLINIC_NAME` kerak emas.

---

## 5. Deploy qilish

1. Barcha environment variable larni kiritgandan so'ng:
   - **Save Changes** tugmasini bosing
2. Render avtomatik build va deploy boshlaydi
3. **Logs** bo'limidan kuzating:
   ```
   🚀 Application is running on: http://0.0.0.0:3000
   X ta bot ishga tushirildi
   Super admin bot webhook set
   ```

---

## 6. Webhook-larni tekshirish

Deploy tugagandan so'ng:

```bash
# Health check
curl https://your-app.onrender.com/health
# → {"status":"ok","timestamp":"..."}

# Clinic webhook test (ID ni to'g'rilang)
curl -X POST https://your-app.onrender.com/webhook/1 \
  -H "Content-Type: application/json" \
  -d '{"update_id":1}'
```

---

## 7. Yangi klinika qo'shish

### Super Admin boti orqali (tavsiya):
1. Super admin bot → `/start`
2. 🏥 Klinikalar → ➕ Yangi klinika
3. Nom, Bot Token, Admin ID kiriting

### Super Admin Mini App orqali:
1. `https://your-app.onrender.com/super-admin` ni brauzerda oching
2. **Klinikalar** → **➕ Yangi klinika**

### API orqali (dasturchi uchun):
```bash
curl -X POST https://your-app.onrender.com/api/super-admin/clinics \
  -H "Content-Type: application/json" \
  -H "x-init-data: <super_admin_init_data>" \
  -d '{"name":"Yangi Klinika","botToken":"BOT_TOKEN","adminIds":[123456]}'
```

---

## 8. Super Admin boti buyruqlari

Super admin faqat `/start` bosadi — keyin inline tugmalar orqali boshqaradi:

| Menyu | Nima qiladi |
|-------|-------------|
| 📊 Statistika | Klinikalar va to'lovlar statistikasi |
| 🏥 Klinikalar | Barcha klinikalar ro'yxati, sozlash |
| 💳 To'lovlar | Kutayotgan to'lovlarni tasdiqlash/rad etish |

---

## 9. Clinic Admin boti buyruqlari

Klinika admini `/admin` yuborsalar — mini app tugmasi va inline panel chiqadi.

| Buyruq | Nima qiladi |
|--------|-------------|
| `/admin` | Admin panel (mini app + inline menyu) |
| `/paid` | Obuna to'lovi — reja tanlash, karta ma'lumotlari, screenshot yuborish |

---

## 10. Obuna tizimi

| Holat | Ma'no |
|-------|-------|
| `trial` | 14 kunlik bepul sinov |
| `active` | To'lov qilingan, faol |
| `grace` | Muddat tugagan, 3 kunlik imtiyoz davri |
| `expired` | Bot to'xtatilgan |
| `suspended` | Super admin to'xtatgan |

**To'lov jarayoni:**
1. Klinika admin `/paid` → reja tanlaydi → karta ma'lumotlari ko'rinadi
2. Admin pul o'tkazadi → screenshot yuboradi
3. Super admin bildirishnoma oladi (clinic boti orqali)
4. Super admin boti → 💳 To'lovlar → ✅ Tasdiqlash
5. Klinika admini "tasdiqlandi" xabari oladi, obuna uzayadi

---

## 11. Xatolarni bartaraf etish

**Bot ishlamayapti:**
```bash
# Webhook holatini tekshirish
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**Ma'lumotlar bazasiga ulanmayapti:**
- `DB_SSL=true` o'rnatilganligini tekshiring
- Render Postgres **Internal** URL ishlatilganligini tekshiring

**Super admin boti javob bermayapti:**
- `SUPER_ADMIN_BOT_TOKEN` to'g'ri ekanligini tekshiring
- `SUPER_ADMIN_IDS` da sizning Telegram ID ingiz borligini tekshiring

**Render free tier uyquga ketishi (spin-down):**
- Birinchi so'rov 30-60 soniya uyg'otish vaqtini talab qiladi
- Yechim: Render paid plan yoki external monitoring xizmati (UptimeRobot)

---

## 12. Muhim xavfsizlik eslatmalari

- `SUPER_ADMIN_BOT_TOKEN` ni **hech qachon** kodni ichiga yozmang
- Render Environment Variables bo'limida saqlang
- `DB_PASSWORD` ni ham shu tarzda saqlang
- Render logs da token chiqib qolmasligi uchun `console.log` larni tekshiring
