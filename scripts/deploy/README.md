# VDS deploy helpers

Контур: `app.axiona.world` на VDS в Москве (ADR-025). Корпоративный `axiona.world` остаётся на Vercel.

```bash
# на VDS с 2 ГБ RAM — до запуска контейнеров
sudo scripts/deploy/setup-swap.sh

cp .env.production.example .env.production
# заполнить секреты; .env.production gitignored
docker compose --env-file .env.production up -d --build
scripts/deploy/migrate.sh
curl -fsS https://app.axiona.world/api/health
```

Бэкапы:

```bash
# ежедневно в cron
scripts/deploy/backup.sh
# проверка восстановления в отдельную БД axiona_restore
scripts/deploy/restore-test.sh /var/backups/axiona/axiona-<stamp>.sql.gz
```

Требования:

- PostgreSQL не публикуется наружу;
- TLS через Caddy;
- `AUTH_REGISTRATION_DISABLED=1` до legal/QA;
- сборку образа лучше делать в CI, а не на VDS с 1 CPU/4 ГБ.
