# 📦 Database Backup Instructions

## ⚠️ ВАЖНО: Това е READ-ONLY операция - НЕ променя данни!

## Вариант 1: Локално изпълнение (ако имате DATABASE_URL)

```bash
cd production-backend

# Задайте DATABASE_URL като environment variable
export DATABASE_URL="postgresql://username:password@host:5432/database"

# Или създайте .env файл с DATABASE_URL
echo 'DATABASE_URL="postgresql://username:password@host:5432/database"' > .env

# Изпълнете backup скрипта
node backup-database.js
```

## Вариант 2: Изпълнение на production сървъра (AWS ECS)

Ако backend-ът е на AWS ECS, можете да:

1. **SSH към ECS task** и изпълнете скрипта там (има достъп до DATABASE_URL)
2. **Или използвайте AWS Systems Manager Session Manager** за да се свържете

```bash
# В production-backend директорията на сървъра
node backup-database.js
```

## Вариант 3: Използване на AWS RDS snapshot (най-безопасно)

Ако базата е на AWS RDS, можете да направите snapshot:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier your-db-instance \
  --db-snapshot-identifier backup-$(date +%Y%m%d-%H%M%S)
```

## Резултат

Backup-ът ще се създаде в:
```
production-backend/backups/backup-YYYY-MM-DDTHH-MM-SS/
├── backup.json      # Пълен JSON backup
├── backup.sql       # SQL INSERT statements за restore
└── summary.txt      # Резюме с брой редове
```

## Възстановяване (ако е необходимо)

```bash
# От SQL файл
psql $DATABASE_URL < backups/backup-YYYY-MM-DDTHH-MM-SS/backup.sql

# Или от JSON (ще трябва custom скрипт)
```

