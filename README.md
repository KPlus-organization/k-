# k-

Веб-приложение. Фронтенд и бэкенд находятся в одном репозитории, но это два независимых npm-проекта.

| Папка                     | Что внутри                                     | Точка входа |
| ------------------------- | ---------------------------------------------- | ----------- |
| [`backend/`](backend/)    | API на TypeScript + Express + PostgreSQL       | `backend/src/index.ts`, `npm run dev` → http://localhost:3001 |
| [`frontend/`](frontend/)  | React + TypeScript + Vite, прототип по Figma на моках | [`frontend/README.md`](frontend/README.md), dev-сервер → http://localhost:3000 |
| [`docs/`](docs/)          | Общий контракт API между фронтендом и бэкендом | [`docs/api.md`](docs/api.md) |

## Быстрый старт

Требования: Node.js 24 LTS+, PostgreSQL. Как создать локальную БД, описано в [backend/README.md](backend/README.md#локальная-база).

```bash
cd backend
npm install
cp .env.example .env    # заполнить DATABASE_URL и JWT_SECRET
npm run db:migrate
npm run db:seed
npm run dev
curl http://localhost:3001/api/health
```

Фронтенд: см. [frontend/README.md](frontend/README.md).

## Правила совместной работы

- Изменения API (новые эндпоинты, поля, коды ошибок) сначала описываются в `docs/api.md`, затем реализуются.
- Файлы `.env` не коммитятся. Образец настроек — `backend/.env.example`.
- CI: `.github/workflows/frontend.yml` и `.github/workflows/backend.yml` (с PostgreSQL и сидером).
