# k-

Веб-приложение. Фронтенд и бэкенд находятся в одном репозитории, но это два независимых npm-проекта.

| Папка                     | Что внутри                                     | Точка входа |
| ------------------------- | ---------------------------------------------- | ----------- |
| [`backend/`](backend/)    | API на TypeScript + Express + PostgreSQL       | `backend/src/index.ts`, `npm run dev` → http://localhost:3001 |
| [`frontend/`](frontend/)  | React + TypeScript + Vite по макету Figma, данные из API | [`frontend/README.md`](frontend/README.md), dev-сервер → http://localhost:3000 |
| [`content/`](content/)    | Наполнение сайта: объекты защиты, статьи, чек-листы, DOCX, пошлины калькулятора — единственный источник | [`content/README.md`](content/README.md) |
| [`docs/`](docs/)          | Общий контракт API между фронтендом и бэкендом | [`docs/api.md`](docs/api.md) |
| [`deploy/`](deploy/)      | Docker-образы, docker compose и автодеплой на VPS | [`deploy/README.md`](deploy/README.md) |

## Локальный запуск

Сайт состоит из трёх частей, и для работы нужны все три:

| Часть | Адрес | Что делает |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | База данных: наполнение сайта и пользователи |
| Бэкенд | http://localhost:3001 | API, через которое сайт получает и сохраняет данные |
| Фронтенд | **http://localhost:3000** | Сам сайт — этот адрес открывают в браузере |

Шаги 1–4 выполняются **один раз** на компьютере, шаг 5 — при каждом запуске.
Команды ниже выполняются в терминале: в Linux — bash, в Windows — **PowerShell**.

### 1. Установить программы

<details open>
<summary><b>Linux (Debian / Ubuntu)</b></summary>

```bash
# Git, curl и PostgreSQL из репозитория дистрибутива (на Debian 13 — PostgreSQL 17).
# Служба PostgreSQL запускается сама и слушает только localhost:5432.
sudo apt-get update
sudo apt-get install -y git curl postgresql

# Node.js 24 через nvm — в домашнюю папку, без sudo
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm alias default 24
```

</details>

<details open>
<summary><b>Windows 10/11</b></summary>

1. **Git** — установщик с https://git-scm.com/download/win, все параметры по умолчанию.
2. **Node.js 24 LTS** (или новее) — установщик `.msi` с https://nodejs.org, параметры по умолчанию.
3. **PostgreSQL 17** — установщик с https://www.postgresql.org/download/windows/.
   При установке задайте и **запомните пароль пользователя `postgres`**, порт оставьте `5432`.
   Служба PostgreSQL будет запускаться вместе с Windows.

После установки **откройте новое окно PowerShell**, чтобы оно увидело `node` и `npm`.

</details>

Проверка (одинаково для обеих систем):

```bash
node -v    # v24.x или новее
npm -v
git --version
```

### 2. Получить код

Linux:

```bash
git clone https://github.com/LisGolub/k-.git ~/k-
cd ~/k-
```

Windows — в папку пользователя, **не в `C:\Program Files`**: туда без прав администратора нельзя
записывать, и `npm install` будет падать с ошибками доступа.

```powershell
git clone https://github.com/LisGolub/k-.git $HOME\projects\k-
cd $HOME\projects\k-
```

Чтобы работать с другой веткой: `git checkout <имя-ветки>`.

### 3. Создать базу данных

Создаются пустая база `k_dev` и её владелец — роль `k_app`. Придумайте для роли пароль из
латинских букв и цифр: другие символы пришлось бы кодировать в строке подключения.

Linux:

```bash
sudo -u postgres psql -v ON_ERROR_STOP=1 -v app_password='ПАРОЛЬ_БАЗЫ' < backend/db/create-dev-db.sql
```

Windows (запросит пароль пользователя `postgres` из шага 1):

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -v ON_ERROR_STOP=1 -v app_password='ПАРОЛЬ_БАЗЫ' -f backend\db\create-dev-db.sql
```

Должно появиться `CREATE ROLE` и `CREATE DATABASE`.

### 4. Настроить и подготовить бэкенд

```bash
cd backend
npm install
```

Создайте файл настроек `backend/.env` из образца:

| Linux | Windows |
| --- | --- |
| `cp .env.example .env` | `Copy-Item .env.example .env` |

Сгенерируйте секрет для подписи токенов (команда одинаковая для обеих систем):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Откройте `backend/.env` в редакторе и заполните три строки:

```ini
DATABASE_URL=postgresql://k_app:ПАРОЛЬ_БАЗЫ@localhost:5432/k_dev
JWT_SECRET=строка, которую вывела команда выше
SEED_DEMO_PASSWORD=любой пароль от 8 символов для демо-пользователя
```

Остальные значения подходят как есть. Файл `.env` не попадает в Git.

Создайте таблицы и загрузите наполнение сайта:

```bash
npm run db:migrate      # таблицы
npm run db:seed         # статьи, чек-листы и объекты защиты из content/
npm run db:seed:demo    # демо-пользователь anna_kuznetsova с паролем из SEED_DEMO_PASSWORD
```

Подготовьте фронтенд:

```bash
cd ../frontend
npm install
```

### 5. Запуск

Нужны **два терминала**, оба остаются открытыми, пока вы работаете с сайтом.

Терминал 1 — бэкенд:

```bash
cd backend      # путь от корня репозитория
npm run dev
```

Готово, когда появится `[server] Listening on http://localhost:3001`.

Терминал 2 — фронтенд:

```bash
cd frontend
npm run dev
```

Откройте в браузере **http://localhost:3000**.

- Войти можно демо-пользователем: логин `anna_kuznetsova` или email `anna@example.com`,
  пароль — значение `SEED_DEMO_PASSWORD` из `backend/.env`. Или создайте свой профиль.
- Остановить серверы — `Ctrl+C` в каждом терминале. Код меняется «на лету»: серверы
  перезапускаются сами, перезапускать вручную не нужно.
- Проверить, что бэкенд и база работают: http://localhost:3001/api/health →
  `{"status":"ok","database":"up"}`.

### После `git pull`

Если пришли изменения, перед запуском выполните:

```bash
cd backend
npm install
npm run db:migrate    # новые миграции, если есть
npm run db:seed       # обновлённое наполнение из content/
cd ../frontend
npm install
```

Все эти команды безопасно запускать повторно: если ничего не изменилось, они ничего не делают.

### Если что-то не работает

| Что видно | Причина и решение |
| --- | --- |
| `npm: command not found` (Linux) | Терминал открыт до установки Node.js: выполните `source ~/.bashrc` или откройте новый |
| `npm` не найден (Windows) | Откройте новое окно PowerShell после установки Node.js |
| `npm.ps1 cannot be loaded because running scripts is disabled` (Windows) | Один раз выполните `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` и подтвердите |
| Бэкенд пишет `Invalid environment configuration` и список | В `backend/.env` не заполнены или неверны перечисленные переменные (шаг 4) |
| `/api/health` отвечает `DATABASE_UNAVAILABLE` | PostgreSQL не запущен или неверен `DATABASE_URL`. Linux: `sudo systemctl start postgresql`. Windows: «Службы» → `postgresql-x64-17` → «Запустить». Сверьте пароль в `DATABASE_URL` с шагом 3 |
| `password authentication failed for user "k_app"` | Пароль в `DATABASE_URL` не совпадает с паролем из шага 3 |
| `EADDRINUSE` или `Port 3000 is already in use` | Сервер уже запущен в другом терминале — закройте его или используйте его |
| На сайте «Не удалось загрузить данные» / «Сервер недоступен» | Не запущен бэкенд (терминал 1) |
| В консоли браузера ошибка CORS | Сайт открыт не по `localhost:3000` / `127.0.0.1:3000`: добавьте адрес в `FRONTEND_ORIGIN` в `backend/.env` |
| `db:seed` пишет `Invalid content` | Ошибка в файлах `content/` — в сообщении указано, где именно ([правила](content/README.md)) |

Подробности по каждой части: [backend/README.md](backend/README.md) (настройки, база, тесты),
[frontend/README.md](frontend/README.md) (архитектура, проверки, браузерные тесты),
[content/README.md](content/README.md) (как править наполнение).

## Правила совместной работы

- Изменения API (новые эндпоинты, поля, коды ошибок) сначала описываются в `docs/api.md`, затем реализуются.
- Файлы `.env` не коммитятся. Образец настроек — `backend/.env.example`.
- Наполнение сайта меняется только в `content/` (правила — в [content/README.md](content/README.md)) и
  попадает в базу через `npm run db:seed` при развёртывании.
- CI: `.github/workflows/backend.yml` и `.github/workflows/frontend.yml`; оба поднимают PostgreSQL
  и синхронизируют наполнение, браузерные тесты идут против настоящего API.
