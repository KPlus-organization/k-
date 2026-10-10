# k-

Веб-приложение. Фронтенд и бэкенд находятся в одном репозитории, но это два независимых npm-проекта.

| Папка                     | Что внутри                                     | Точка входа |
| ------------------------- | ---------------------------------------------- | ----------- |
| [`backend/`](backend/)    | API на TypeScript + Express + PostgreSQL       | `backend/src/index.ts`, `npm run dev` → http://localhost:3001 |
| [`frontend/`](frontend/)  | Клиентская часть (стек выбирается)             | [`frontend/README.md`](frontend/README.md), dev-сервер → http://localhost:3000 |
| [`docs/`](docs/)          | Общий контракт API между фронтендом и бэкендом | [`docs/api.md`](docs/api.md) |

## Быстрый старт

Требования: Node.js 24 LTS+, PostgreSQL. Как создать локальную БД, описано в [backend/README.md](backend/README.md#локальная-база-данных).

```bash
cd backend
npm install
cp .env.example .env    # заполнить DATABASE_URL
npm run dev
curl http://localhost:3001/api/health
```

Фронтенд: см. [frontend/README.md](frontend/README.md).

## Правила совместной работы

- Изменения API (новые эндпоинты, поля, коды ошибок) сначала описываются в `docs/api.md`, затем реализуются.
- Файлы `.env` не коммитятся. Образец настроек — `backend/.env.example`.
