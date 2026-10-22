# Деплой на VPS

Сайт работает на сервере в трёх Docker-контейнерах:

| Контейнер | Образ | Что делает |
| --- | --- | --- |
| `web` | `ghcr.io/kplus-organization/k-web` | Caddy: HTTPS для домена, отдаёт собранный фронтенд, проксирует `/api/*` в `backend`. Единственный, у кого открыты порты наружу (80 и 443) |
| `backend` | `ghcr.io/kplus-organization/k-backend` | API. При каждом старте применяет миграции и синхронизирует `content/` в базу |
| `db` | `postgres:17` | База, данные в volume `k-_pgdata` |

Образы собирает GitHub Actions ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)), сервер их только скачивает.

## Как попадают изменения на сайт

```
ветка → PR → проверки (Backend/Frontend checks) → merge в main
  → Deploy: те же проверки → сборка образов → ssh на сервер → docker compose pull && up -d
```

Ничего на сервере руками делать не нужно: смёржили PR — через несколько минут сайт обновлён.
Прогресс и ошибки видны во вкладке **Actions → Deploy**. Если проверки на `main` не прошли, деплой не происходит и на сайте остаётся прежняя версия.

- **Контент** (`content/`) — обычный PR. Бэкенд при старте сам обновит базу.
- **Схема базы** — новый файл в `backend/db/migrations/`. Применится при деплое. Уже применённые миграции не редактировать.
- **Передеплоить без изменений** — Actions → Deploy → Run workflow.
- Во время перезапуска `backend` сайт недоступен несколько секунд.

## Разовая настройка сервера

Подойдёт любой VPS с Ubuntu 24.04 или Debian 12/13, от 1 ГБ RAM.

### 1. Docker и пользователь для деплоя

Под `root`:

```bash
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -o deploy -g deploy /opt/k-

# Файрвол: SSH, HTTP и HTTPS (443/udp — для HTTP/3)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable
```

Порты, опубликованные Docker, открываются в обход `ufw`. Поэтому наружу публикуются только порты `web`, а у базы и бэкенда портов нет.
Членство в группе `docker` по сути равно правам root, так что ключ `deploy` храните так же бережно, как root-доступ.

### 2. SSH-ключ для GitHub Actions

На своём компьютере:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/k-deploy -N "" -C github-deploy
cat ~/.ssh/k-deploy.pub        # одна строка "ssh-ed25519 AAAA... github-deploy"
```

У `deploy` нет пароля, поэтому `ssh-copy-id` не сработает. Публичный ключ добавляется под `root` на сервере:

```bash
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo 'ssh-ed25519 AAAA... github-deploy' >> /home/deploy/.ssh/authorized_keys   # строка из .pub
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

Проверка с компьютера:

```bash
ssh -i ~/.ssh/k-deploy deploy@<IP> docker ps   # таблица контейнеров, без запроса пароля
```

Ключи хоста для `SSH_KNOWN_HOSTS` — прямо из файлов сервера, по уже проверенному соединению
(`ssh-keyscan` ненадёжен: OpenSSH 10 временно блокирует адрес, который подключается без входа):

```bash
ssh deploy@<IP> 'for t in ed25519 ecdsa rsa; do echo "<IP> $(cut -d" " -f1,2 /etc/ssh/ssh_host_${t}_key.pub)"; done'
```

### 3. Файл `.env` на сервере

```bash
ssh deploy@<IP>
nano /opt/k-/.env      # содержимое — из deploy/.env.example, заполнить
chmod 600 /opt/k-/.env
```

`SITE_DOMAIN` — домен сайта, его A-запись должна указывать на IP сервера. `SITE_ORIGIN` — адрес сайта в браузере, `https://<домен>`.

### 4. Секреты в GitHub

Settings → Secrets and variables → Actions → New repository secret:

| Секрет | Значение |
| --- | --- |
| `SSH_HOST` | IP сервера |
| `SSH_PORT` | порт SSH, если не 22 (можно не создавать) |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | содержимое `~/.ssh/k-deploy` (приватный ключ целиком) |
| `SSH_KNOWN_HOSTS` | три строки ключей хоста (команда выше) |

### 5. Первый деплой

Смёржите ветку с этими файлами в `main` — запустится Deploy. После него сайт открывается по `https://<домен>/`.
Кнопка Run workflow появляется только после того, как `deploy.yml` окажется в `main`.

## Работа на сервере

```bash
ssh deploy@<IP>
cd /opt/k-
docker compose ps                 # состояние контейнеров
docker compose logs -f backend    # логи API (web, db — аналогично)
docker compose restart backend
```

Образы в GHCR приватные. Для ручного `docker compose pull` на сервере один раз выполните `docker login ghcr.io`
с [personal access token](https://github.com/settings/tokens) с правом `read:packages`. Автодеплою это не нужно, он логинится сам.

### Откат

- Actions → открыть прошлый успешный запуск Deploy → **Re-run all jobs**. Пересоберётся и выкатится тот коммит.
- Или на сервере: `TAG=<sha коммита> docker compose up -d` (нужен `docker login`, см. выше).

Миграции базы при откате не отменяются. Старый код должен работать с новой схемой, поэтому миграции лучше делать совместимыми: добавлять, а не удалять или переименовывать.

### Бэкап базы

Volume — это не бэкап. Ежедневный дамп с хранением 14 дней (`crontab -e` под `deploy`):

```cron
0 3 * * * mkdir -p /opt/k-/backups && cd /opt/k- && docker compose exec -T db pg_dump -U k -Fc k > backups/k-$(date +\%F).dump && find backups -name '*.dump' -mtime +14 -delete
```

Дампы стоит регулярно копировать с сервера. Восстановление:

```bash
docker compose exec -T db pg_restore -U k -d k --clean --if-exists < backups/k-ГГГГ-ММ-ДД.dump
```

## HTTPS и домен

Сайт работает по адресу `https://moepravoplus.ru`. Сертификат Let's Encrypt Caddy получает сам при первом запуске и сам продлевает. Сертификаты хранятся в volume `k-_caddy_data`, переживают передеплой. Покупать или ставить сертификат у хостера не нужно.

- `http://…`, `www.moepravoplus.ru` и `http://<IP>` перенаправляются на `https://moepravoplus.ru` с тем же путём, так что старые ссылки работают.
- Ссылки внутри сайта относительные (`/articles/…`, `/api/…`), от домена они не зависят.
- Чтобы получить сертификат, домен должен указывать на сервер, а порты 80 и 443 должны быть открыты снаружи. Если сертификат не выдаётся, причина будет в `docker compose logs web`.
- Сменить домен: A-запись нового домена на сервер, затем в `.env` поменять `SITE_DOMAIN` и `SITE_ORIGIN` и выполнить `docker compose up -d`.

## Проверить продакшен-сборку локально

Нужен Docker. Создайте `deploy/.env` по примеру с `SITE_DOMAIN=localhost`, `WEB_PORT=8080`, `HTTPS_PORT=8443` и `SITE_ORIGIN=https://localhost:8443`, затем:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/compose.build.yml up --build
```

Сайт откроется по `https://localhost:8443`. Сертификат для `localhost` Caddy выпускает сам, браузер предупредит, что не доверяет ему.
