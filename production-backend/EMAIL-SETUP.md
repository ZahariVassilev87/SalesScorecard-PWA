Request URL
https://api.instorm.io/public-admin/users/08d281be-572e-4590-ab5a-199793077bf7?companyId=company_metro
Request Method
PUT
Status Code
500 Internal Server Error
Remote Address
13.51.144.19:443
Referrer Policy
strict-origin-when-cross-origin
access-control-allow-credentials
true
access-control-allow-origin
https://api.instorm.io
content-length
26
content-type
application/json; charset=utf-8
date
Mon, 17 Nov 2025 21:49:41 GMT
etag
W/"1a-itNe1xXeWJ3sqXJ/013p2TdG9UU"
vary
Origin
x-powered-by
Express
:authority
api.instorm.io
:method
PUT
:path
/public-admin/users/08d281be-572e-4590-ab5a-199793077bf7?companyId=company_metro
:scheme
https
accept
*/*
accept-encoding
gzip, deflate, br, zstd
accept-language
en-GB,en-US;q=0.9,en;q=0.8
authorization
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtZm4wZndqYjAwMDFxcHd0Yms1ZnFuZjIiLCJlbWFpbCI6InZhc3NpbGV2LnphaGFyaUBnbWFpbC5jb20iLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJkaXNwbGF5TmFtZSI6IlphaGFyaSBWYXNzaWxldiIsImNvbXBhbnlJZCI6ImNvbXBhbnlfbWV0cm8iLCJpYXQiOjE3NjM0MTYxNTgsImV4cCI6MTc2MzUwMjU1OH0.gEXKbN4Z8MPifu-l6juGh_fQOJl0HYmyRensmLmu_rA
content-length
115
content-type
application/json
origin
https://api.instorm.io
priority
u=1, i
referer
https://api.instorm.io/public-admin/react-admin/
sec-ch-ua
"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"
sec-ch-ua-mobile
?0
sec-ch-ua-platform
"macOS"
sec-fetch-dest
empty
sec-fetch-mode
cors
sec-fetch-site
same-origin
user-agent
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36# 📧 Настройка на Email за Backup Нотификации

## ✅ Какво е настроено

- ✅ Email адрес за нотификации: **zahari.vasilev@instorm.bg**
- ✅ Cron job за ежедневен backup в 23:00 (11 вечерта)
- ✅ Скрипт за изпращане на email нотификации

## ⚙️ Какво трябва да направите

За да работи email нотификацията, трябва да настроите SMTP настройките.

### Вариант 1: Gmail (най-лесно)

1. **Създайте App Password в Gmail:**
   - Отидете на: https://myaccount.google.com/apppasswords
   - Изберете "Mail" и "Other (Custom name)"
   - Въведете име: "Sales Scorecard Backup"
   - Копирайте генерирания парол (16 символа)

2. **Добавете в `.env` файл:**
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=Sales Scorecard <noreply@instorm.bg>
   BACKUP_NOTIFICATION_EMAIL=zahari.vasilev@instorm.bg
   ```

### Вариант 2: Друг SMTP сървър

Ако използвате друг email провайдър (SendGrid, Mailgun, и т.н.):

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=Sales Scorecard <noreply@instorm.bg>
BACKUP_NOTIFICATION_EMAIL=zahari.vasilev@instorm.bg
```

## 🧪 Тестване на Email

След като настроите SMTP, тествайте:

```bash
cd production-backend

# Тест на успешен backup
node send-backup-notification.js success '{"backupPath":"test-backup","backupSize":"1.2M","totalRows":"1432"}'

# Тест на неуспешен backup
node send-backup-notification.js failure '{"error":"Test error message"}'
```

## 📋 Какво получавате в email

**При успешен backup:**
- ✅ Статус: Backup completed successfully
- 📁 Местоположение на backup-а
- 📊 Размер на backup-а
- 📈 Брой редове данни

**При неуспешен backup:**
- ❌ Статус: Backup failed
- 🔍 Детайли за грешката

## ⚠️ Важно

- Без SMTP настройки, backup-ите ще се правят, но няма да получавате email нотификации
- Проверете логовете: `tail -f production-backend/backups/backup.log`
- Backup-ите се правят всеки ден в 23:00, независимо от email настройките


