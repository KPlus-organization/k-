# k- — backend

Бэкенд веб-приложения на **TypeScript + Express 5 + PostgreSQL**.

Сейчас это технический каркас: конфигурация, подключение к БД, CORS, обработка ошибок и
эндпоинты проверки работоспособности. Бизнес-логика и модель данных ещё не определены.
Фронтенд живёт в этом же репозитории, в [`../frontend`](../frontend/README.md). Контракт API: [docs/api.md](../docs/api.md).

Все команды ниже выполняются из папки `backend/`.

## Требования

- **Node.js 24 LTS** или новее, npm (идёт вместе с Node.js)
- **PostgreSQL** — нужен для `GET /api/health` и будущих функций.
  Без него сервер запускается, но health-check отвечает `503`.

## Установка

```bash
cd backend
npm install
cp .env.example .env
```

Затем отредактируйте `backend/.env` и создайте локальную БД (раздел «Локальная база данных»).

## Конфигурация

Все настройки задаются переменными окружения. Локально их можно хранить в файле `backend/.env`:
он загружается через dotenv (из какой бы папки ни запускалось приложение) и **не попадает в Git**. Переменные, уже заданные в окружении
процесса, имеют приоритет над `.env`.

| Переменная        | Обязательна | По умолчанию            | Описание |
| ----------------- | ----------- | ----------------------- | -------- |
| `NODE_ENV`        | нет         | `development`           | `development` / `production` / `test` |
| `PORT`            | нет         | `3001`                  | Порт HTTP-сервера |
| `DATABASE_URL`    | **да**      | —                       | Подключение к PostgreSQL |
| `FRONTEND_ORIGIN` | нет         | `http://localhost:3000` | Единственный origin, которому разрешён CORS |

Подключение к БД задаётся **только** через `DATABASE_URL`, отдельных переменных `PGHOST`/`PGUSER`
и т. п. нет:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

- Спецсимволы в пароле кодируются (`@` → `%40`, `:` → `%3A`, `/` → `%2F`).
- Для TLS добавьте параметр, например `?sslmode=require`.

При старте конфигурация проверяется. Если что-то задано неверно, приложение завершится с понятным
списком ошибок.

Приложение само не создаёт ни базу, ни пользователей, ни таблицы.

## Локальная база данных

Для разработки используется пустая БД-заглушка `k_dev`, её владелец — роль `k_app`. Таблиц предметной
области пока нет: модель данных ещё не согласована. Настройка на Debian/Ubuntu (нужен sudo):

```bash
# 1. PostgreSQL из репозитория дистрибутива (на Debian 13 это версия 17).
#    Служба запускается сама и слушает только localhost:5432.
sudo apt-get install -y postgresql

# 2. Роль и база. Пароль придумайте сами (лучше из [A-Za-z0-9], чтобы не кодировать его в URL).
sudo -u postgres psql -v ON_ERROR_STOP=1 -v app_password='ВАШ_ПАРОЛЬ' < db/create-dev-db.sql

# 3. В backend/.env:
# DATABASE_URL=postgresql://k_app:ВАШ_ПАРОЛЬ@localhost:5432/k_dev
```

Проверка: `npm run dev`, затем `curl http://localhost:3001/api/health` → `{"status":"ok","database":"up"}`.

Удалить заглушку: `sudo -u postgres psql -c 'DROP DATABASE k_dev' -c 'DROP ROLE k_app'`.

## Команды

| Команда             | Что делает |
| ------------------- | ---------- |
| `npm run dev`       | Запуск из исходников через `ts-node-dev`, автоперезапуск при изменениях. Типы не проверяются ради скорости, для этого есть `typecheck` |
| `npm run typecheck` | Проверка типов без генерации файлов (`tsc --noEmit`) |
| `npm run build`     | Компиляция в `dist/` (`tsc`) |
| `npm start`         | Запуск собранного приложения (`node dist/index.js`) |

Продакшен-запуск:

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

Сервер обрабатывает `SIGINT` и `SIGTERM`: перестаёт принимать новые соединения, дожидается
текущих запросов, закрывает пул PostgreSQL и завершается. Если остановка длится дольше 10 с,
процесс завершается принудительно с кодом `1`.

## Структура проекта

```
backend/src/
├── index.ts                 # Точка входа: запуск HTTP-сервера, graceful shutdown
├── app.ts                   # Создание и настройка Express-приложения
├── config/
│   ├── env.ts               # Чтение и проверка переменных окружения
│   ├── db.ts                # Пул PostgreSQL (pg.Pool), проверка связи, закрытие
│   └── cors.ts              # Настройки CORS
├── controllers/
│   └── healthController.ts  # GET / и GET /api/health
├── routes/
│   └── healthRoutes.ts      # Маршруты проверки состояния
├── middlewares/
│   ├── notFound.ts          # 404 для неизвестных маршрутов
│   └── errorHandler.ts      # Централизованная обработка ошибок → единый JSON
└── errors/
    └── HttpError.ts         # Ошибка с HTTP-статусом и безопасным для клиента кодом/сообщением
backend/db/
└── create-dev-db.sql        # Создание локальной БД-заглушки и роли (без таблиц)
```

Документация API лежит в корне репозитория: `../docs/api.md`.

### Как добавить новый эндпоинт

1. Обработчик — в `src/controllers/<area>Controller.ts`.
2. Маршруты — в `src/routes/<area>Routes.ts` (`Router()`), подключить в `src/app.ts`
   **до** `notFound` и `errorHandler`.
3. Ошибки, которые нужно показать клиенту, бросать как
   `throw new HttpError(status, 'CODE', 'Message')`. Express 5 сам передаёт исключения из
   async-обработчиков в `errorHandler`. Любая другая ошибка превращается в `500 INTERNAL_ERROR`
   без деталей для клиента.
4. Запросы к БД — через `pool` из `src/config/db.ts`, только с параметрами (`$1`, `$2`, …),
   без конкатенации строк.
5. Описать эндпоинт и новые коды ошибок в `../docs/api.md`.

## Технические решения

- **Модули: CommonJS.** `"type": "commonjs"` в `package.json`, `module`/`moduleResolution: NodeNext`
  в `tsconfig.json`. `ts-node-dev` не поддерживает ESM, а `NodeNext` точно моделирует,
  как Node.js будет загружать `dist/`.
- **TypeScript 6.x.** TypeScript 7 не предоставляет JS API, на котором работает `ts-node-dev`,
  поэтому версия зафиксирована как `^6`.
- **`npm audit`.** У dev-зависимости `ts-node-dev` (через `chokidar` → `braces`) есть уязвимость high
  без исправления: DoS при разборе glob-шаблонов. Она касается только локального наблюдения за файлами
  и не попадает в продакшен (`npm audit --omit=dev` → 0 уязвимостей).
