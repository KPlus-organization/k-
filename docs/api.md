# API бэкенда — контракт для фронтенда

Документ описывает HTTP API бэкенда (`backend/`) для фронтенда (`frontend/`).
Все перечисленные эндпоинты **реализованы** и покрыты автотестами (`backend/tests`).
Изменения API сначала вносятся в этот документ, затем в код.

Содержание:

1. [Общие сведения](#1-общие-сведения)
2. [Аутентификация (JWT)](#2-аутентификация-jwt)
3. [Список эндпоинтов](#3-список-эндпоинтов)
4. [Типы данных](#4-типы-данных)
5. [Эндпоинты: служебные](#5-эндпоинты-служебные)
6. [Эндпоинты: аутентификация](#6-эндпоинты-аутентификация)
7. [Эндпоинты: профиль](#7-эндпоинты-профиль)
8. [Эндпоинты: избранное](#8-эндпоинты-избранное)
9. [Эндпоинты: история](#9-эндпоинты-история)
10. [Эндпоинты: контент, поиск и пошлины](#10-эндпоинты-контент-поиск-и-пошлины)
11. [Маршруты сайта и наполнение](#11-маршруты-сайта-и-наполнение)
12. [CORS](#12-cors)
13. [Соглашения: JSON, статусы, ошибки](#13-соглашения-json-статусы-ошибки)
14. [Наполнение и демо-данные](#14-наполнение-и-демо-данные)
15. [Не реализовано](#15-не-реализовано)

---

## 1. Общие сведения

| Параметр | Значение |
| --- | --- |
| Базовый URL (локально) | `http://localhost:3001` |
| Префикс API | `/api` |
| Формат | JSON, UTF-8 |
| Аутентификация | `Authorization: Bearer <accessToken>` (JWT). Cookies не используются |
| Даты | строки ISO 8601 в UTC, например `2023-10-12T00:00:00.000Z`. Форматирование для показа — на фронтенде |
| Идентификаторы | пользователи и записи истории — UUID; объекты защиты и материалы — строковые slug (`code`, `checklist`) |

Адрес API во фронтенде задаётся переменной окружения сборщика, например `VITE_API_URL=http://localhost:3001`.

Запуск бэкенда, миграции и сидер описаны в [backend/README.md](../backend/README.md).

## 2. Аутентификация (JWT)

После регистрации или входа сервер выдаёт пару токенов:

| Токен | Что это | Срок жизни | Как использовать |
| --- | --- | --- | --- |
| `accessToken` | JWT (HS256), `sub` = id пользователя | 15 минут (`expiresIn`, секунды) | Заголовок `Authorization: Bearer <accessToken>` во всех защищённых запросах |
| `refreshToken` | Случайная непрозрачная строка | 30 дней (`refreshTokenExpiresAt`) | Только в `POST /api/auth/refresh` и `POST /api/auth/logout` |

Сценарий работы клиента:

1. `POST /api/auth/register` или `POST /api/auth/login` → сохранить оба токена.
2. Запросы к защищённым эндпоинтам — с заголовком `Authorization: Bearer <accessToken>`.
3. Ответ `401` с кодом `TOKEN_EXPIRED` → вызвать `POST /api/auth/refresh` с `refreshToken`,
   сохранить **новую** пару и повторить исходный запрос один раз.
4. `refresh` вернул `401 INVALID_REFRESH_TOKEN` → сессия закончилась, удалить токены и отправить на `/login`.
5. Выход: `POST /api/auth/logout` с `refreshToken`, затем удалить токены на клиенте.

Важно:

- **Ротация refresh-токена.** Каждый вызов `refresh` возвращает новый `refreshToken`, а старый
  становится недействительным. Если старый токен предъявить повторно, сервер считает его украденным
  и отзывает **все** сессии пользователя. Поэтому параллельные запросы, получившие `TOKEN_EXPIRED`,
  должны дождаться одного общего вызова `refresh`, а не вызывать его каждый сам.
- Access-токен после logout остаётся действительным до истечения срока (до 15 минут): JWT без
  состояния, сервер его не отзывает. Клиент должен просто удалить его.
- Хранение на клиенте: рекомендуется держать `accessToken` в памяти, а `refreshToken` — в `localStorage`
  (или тоже в памяти, если допустим повторный вход после перезагрузки страницы). Любое хранилище,
  доступное JavaScript, уязвимо при XSS: это осознанный компромисс выбранной схемы без cookies.

## 3. Список эндпоинтов

| Метод | Путь | Авторизация | Назначение | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | — | Сервер работает | 200 | — |
| GET | `/api/health` | — | Сервер и БД работают | 200 | 503 |
| POST | `/api/auth/register` | — | Регистрация | 201 | 400, 409 |
| POST | `/api/auth/login` | — | Вход по логину или email | 200 | 400, 401 |
| POST | `/api/auth/refresh` | — | Обновление пары токенов | 200 | 400, 401 |
| POST | `/api/auth/logout` | — | Отзыв refresh-токена | 204 | 400 |
| GET | `/api/profile` | Bearer | Текущий пользователь | 200 | 401 |
| PATCH | `/api/profile` | Bearer | Изменение имени, логина, email | 200 | 400, 401, 409 |
| GET | `/api/favorites` | Bearer | Избранные материалы | 200 | 401 |
| PUT | `/api/favorites/:materialId` | Bearer | Добавить в избранное | 204 | 401, 404 |
| DELETE | `/api/favorites/:materialId` | Bearer | Удалить из избранного | 204 | 401 |
| GET | `/api/history` | Bearer | История навигации | 200 | 400, 401 |
| POST | `/api/history` | Bearer | Добавить запись истории | 201 | 400, 401 |
| GET | `/api/objects` | — | Объекты защиты | 200 | — |
| GET | `/api/materials` | — | Список материалов, фильтр по теме | 200 | 400 |
| GET | `/api/materials/:id` | — | Материал целиком | 200 | 404 |
| GET | `/api/materials/:id/file` | — | Скачать исходный DOCX | 200 | 404 |
| GET | `/api/search` | — | Поиск по объектам и материалам | 200 | 400 |
| GET | `/api/fees` | — | Виды пошлин в калькуляторе | 200 | — |
| GET | `/api/fees/:id` | — | Пошлины и параметры одного вида | 200 | 404 |
| POST | `/api/fees/:id/calculate` | — | Расчёт пошлины | 200 | 400, 404 |

Любой другой путь → `404 NOT_FOUND`. Любой эндпоинт может вернуть `500 INTERNAL_ERROR`, а эндпоинты,
работающие с БД, — `503 DATABASE_UNAVAILABLE`, если PostgreSQL недоступен.

## 4. Типы данных

Описания в нотации TypeScript.

```ts
type User = {
  id: string;            // UUID
  name: string;          // отображаемое имя; при регистрации равно login
  login: string;
  email: string;
  registeredAt: string;  // ISO 8601
};

type AuthSession = {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;              // срок жизни accessToken в секундах
  refreshToken: string;
  refreshTokenExpiresAt: string;  // ISO 8601
  user: User;
};

type ProtectionObject = {
  id: string;              // 'code' | 'algorithms' | 'design' | 'databases' | 'brand' | 'visuals' | 'fonts'
  title: string;
  description: string;
  materialsCount: number;  // число материалов с topic = id
};

type MaterialKind = 'article' | 'checklist' | 'reference';

type MaterialSummary = {
  id: string;
  topic: string;           // id объекта защиты
  kind: MaterialKind;
  title: string;
  description: string;
  hasContent: boolean;     // false — опубликована только карточка, полного текста нет
  stepsCount: number;      // число разделов (шагов чек-листа); 0 для статей
};

type Material = MaterialSummary & {
  pageTitle: string;
  // Исходный DOCX: имя файла при скачивании и путь относительно базового URL API
  download: { fileName: string; url: string } | null;
  related: MaterialSummary[];   // связанные материалы в заданном порядке
  intro: ContentBlock[];
  sections: { id: string; title: string; toc: string; blocks: ContentBlock[] }[];
};

// Блоки текста материалов; формат наполнения описан в content/README.md
type TextRun = { text: string; bold?: boolean; italic?: boolean; href?: string; action?: string };
type ContentBlock =
  | { type: 'paragraph' | 'heading' | 'note'; runs: TextRun[] }
  | { type: 'list'; ordered: boolean; items: TextRun[][] }
  | { type: 'table'; rows: TextRun[][][] }
  | { type: 'action'; text: string; action: string };

type Favorite = {
  material: MaterialSummary;
  addedAt: string;  // ISO 8601
};

type HistoryType = 'material' | 'search' | 'tool';

type HistoryEntry = {
  id: string;         // UUID
  type: HistoryType;
  target: string;     // material: id материала; search: текст запроса; tool: id инструмента ('calculator', ...)
  title: string;      // подпись для показа, например «Чек-лист: Защитить программный код»
  visitedAt: string;  // ISO 8601
};
```

## 5. Эндпоинты: служебные

### `GET /`

```http
HTTP/1.1 200 OK

{ "status": "ok", "message": "Backend is running" }
```

### `GET /api/health`

Проверяет подключение к PostgreSQL. Ответ не кэшируется (`Cache-Control: no-store`).

```http
HTTP/1.1 200 OK

{ "status": "ok", "database": "up" }
```

```http
HTTP/1.1 503 Service Unavailable

{ "error": { "code": "DATABASE_UNAVAILABLE", "message": "Database is unavailable" } }
```

## 6. Эндпоинты: аутентификация

### `POST /api/auth/register`

```json
{
  "login": "anna_kuznetsova",
  "email": "anna@example.com",
  "password": "не менее 8 символов",
  "consent": true
}
```

Правила проверки:

| Поле | Правило |
| --- | --- |
| `login` | 3–32 символа после обрезки пробелов; буквы (любой алфавит), цифры, `.`, `_`, `-`. Без пробелов и `@` |
| `email` | до 254 символов, формат `x@y.z` |
| `password` | 8–128 символов, пробелы по краям не обрезаются |
| `consent` | строго `true` — согласие на обработку персональных данных |

Логин и email уникальны **без учёта регистра**. Регистр, введённый пользователем, сохраняется для показа.

`201 Created` → `AuthSession`:

```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "refreshToken": "q3J4n...",
  "refreshTokenExpiresAt": "2026-11-12T10:00:00.000Z",
  "user": {
    "id": "892d74da-0561-4047-9c66-c84113038591",
    "name": "anna_kuznetsova",
    "login": "anna_kuznetsova",
    "email": "anna@example.com",
    "registeredAt": "2026-10-13T10:00:00.000Z"
  }
}
```

Ошибки: `400 VALIDATION_ERROR` (со списком полей в `details`), `409 LOGIN_TAKEN`, `409 EMAIL_TAKEN`.

Проверку совпадения пароля с подтверждением выполняет фронтенд, поле `confirm` на сервер не отправляется.

### `POST /api/auth/login`

```json
{ "identifier": "anna@example.com", "password": "..." }
```

`identifier` — email (если содержит `@`) или логин, без учёта регистра.

`200 OK` → `AuthSession`. Неверный логин и неверный пароль дают **одинаковый** ответ:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid login or password" } }
```

### `POST /api/auth/refresh`

```json
{ "refreshToken": "q3J4n..." }
```

`200 OK` → новый `AuthSession` с новыми `accessToken` и `refreshToken`. Старый refresh-токен больше
не действует.

`401 INVALID_REFRESH_TOKEN` — токен неизвестен, истёк, отозван или уже был использован.

### `POST /api/auth/logout`

```json
{ "refreshToken": "q3J4n..." }
```

`204 No Content`. Идемпотентен: неизвестный или уже отозванный токен тоже даёт `204`.

## 7. Эндпоинты: профиль

### `GET /api/profile`

```http
GET /api/profile
Authorization: Bearer eyJ...
```

```json
{
  "user": {
    "id": "892d74da-0561-4047-9c66-c84113038591",
    "name": "Анна Кузнецова",
    "login": "anna_kuznetsova",
    "email": "anna@example.com",
    "registeredAt": "2023-10-12T00:00:00.000Z"
  }
}
```

### `PATCH /api/profile`

Передаются только изменяемые поля, хотя бы одно:

```json
{ "name": "Анна", "login": "anna_k", "email": "anna.k@example.com" }
```

| Поле | Правило |
| --- | --- |
| `name` | 1–100 символов после обрезки пробелов |
| `login` | как при регистрации |
| `email` | как при регистрации |

Любые другие поля (`id`, `registeredAt`, `password`…) → `400 VALIDATION_ERROR`.

`200 OK` → `{ "user": User }` с обновлёнными данными. Ошибки: `400`, `401`, `409 LOGIN_TAKEN`, `409 EMAIL_TAKEN`.

## 8. Эндпоинты: избранное

Избранное привязано к пользователю и требует авторизации.

### `GET /api/favorites`

Сначала недавно добавленные.

```json
{
  "items": [
    {
      "material": {
        "id": "checklist",
        "topic": "code",
        "kind": "checklist",
        "title": "Чек-лист: Защитить программный код",
        "description": "...",
        "hasContent": true,
        "stepsCount": 8
      },
      "addedAt": "2026-10-13T10:05:00.000Z"
    }
  ]
}
```

### `PUT /api/favorites/:materialId`

Добавляет материал. `204 No Content`. Повторное добавление ничего не меняет и тоже даёт `204`.
Неизвестный материал → `404 MATERIAL_NOT_FOUND`.

### `DELETE /api/favorites/:materialId`

Удаляет материал. `204 No Content`, в том числе если его не было в избранном.

## 9. Эндпоинты: история

История навигации пользователя: открытые материалы, поисковые запросы, инструменты.
**Записи создаёт фронтенд** — сервер сам переходы не отслеживает.

### `GET /api/history?limit=50`

`limit` — 1–100, по умолчанию 50. Сначала новые записи. Группировку по дням выполняет фронтенд.

```json
{
  "items": [
    {
      "id": "e9ed9962-9fc7-42f0-923a-89a5d5e76717",
      "type": "tool",
      "target": "calculator",
      "title": "Калькулятор пошлин",
      "visitedAt": "2026-10-13T11:20:00.000Z"
    }
  ]
}
```

### `POST /api/history`

```json
{ "type": "material", "target": "checklist", "title": "Чек-лист: Защитить программный код" }
```

| Поле | Правило |
| --- | --- |
| `type` | `material`, `search` или `tool` |
| `target` | 1–500 символов; для `material` — id существующего материала |
| `title` | 1–300 символов |

`201 Created` → `HistoryEntry`. Ошибки: `400 VALIDATION_ERROR`, `401`.

## 10. Эндпоинты: контент, поиск и пошлины

Публичные эндпоинты, авторизация не нужна. Наполнение загружается из папки `content/` в корне
репозитория (см. [content/README.md](../content/README.md)). API отдаёт только **опубликованные**
объекты и материалы: снятые с публикации не попадают ни в списки, ни в поиск, ни в избранное,
а запрос по их id даёт `404`.

### `GET /api/objects`

Объекты защиты в порядке показа (литературные произведения исключены, как и во фронтенде).

```json
{
  "items": [
    {
      "id": "code",
      "title": "Программный код",
      "description": "Исходный и объектный код, скрипты и модули. ...",
      "materialsCount": 4
    }
  ]
}
```

### `GET /api/materials?topic=brand`

`topic` необязателен. Возвращает `{ "items": MaterialSummary[] }` в порядке каталога.
Неизвестная тема → пустой список.

### `GET /api/materials/:id`

`200 OK` → `Material`. Для карточек без полного текста (`hasContent: false`) `intro` и `sections`
пустые, `pageTitle` равен `title`. Неизвестный или снятый с публикации id → `404 MATERIAL_NOT_FOUND`.

```json
{
  "id": "checklist",
  "topic": "code",
  "kind": "checklist",
  "title": "...",
  "description": "...",
  "hasContent": true,
  "stepsCount": 8,
  "pageTitle": "Защита программного кода",
  "download": {
    "fileName": "Чек-лист программный год - защита прав.docx",
    "url": "/api/materials/checklist/file"
  },
  "related": [{ "id": "code-0", "topic": "code", "kind": "article", "...": "..." }],
  "intro": [{ "type": "paragraph", "runs": [{ "text": "..." }] }],
  "sections": [{ "id": "step-1", "title": "...", "toc": "Зафиксировать нарушение", "blocks": [] }]
}
```

### `GET /api/materials/:id/file`

Отдаёт исходный DOCX материала с заголовком `Content-Disposition: attachment` и исходным именем
файла (`filename*=UTF-8''…`). Ссылка для фронтенда: базовый URL API + `download.url`.
Материал без файла, неизвестный или снятый с публикации → `404 MATERIAL_NOT_FOUND`.

### `GET /api/search?q=код`

Поиск подстроки без учёта регистра: по названию и описанию объектов защиты и по полному тексту
материалов (название, описание, вступление, разделы).

`q` обрезается по краям, не длиннее 200 символов. Пустой или отсутствующий `q` → пустые результаты.

```json
{
  "query": "код",
  "objects": [{ "id": "code", "title": "Программный код", "description": "...", "materialsCount": 4 }],
  "materials": [{ "id": "checklist", "topic": "code", "kind": "checklist", "...": "..." }]
}
```

### Калькулятор пошлин

Суммы и формулы загружаются из `content/fees/*.yaml` (формат — в [content/README.md](../content/README.md#пошлины)),
расчёт выполняет сервер. Виды: `trademarks` — товарные знаки (Положение о пошлинах, ПП РФ № 941),
`programs` — программы для ЭВМ и базы данных (ст. 333.30 НК РФ).

```ts
type FeeScheduleSummary = {
  id: string;                 // 'trademarks' | 'programs'
  title: string;
  basis: string;              // нормативный акт и редакция
  effectiveFrom: string;      // 'YYYY-MM-DD'
  reviewedBy: string | null;  // кто из юристов сверил суммы; null — ещё не сверено
  feesCount: number;
};

type FeeParameter = {
  id: string;                 // 'классы', 'товары_в_классе', 'бумажное_свидетельство', …
  question: string;           // подпись поля
  type: 'number' | 'yesNo' | 'perClass';
  min?: number;               // для number и для каждого значения perClass
  max?: number;
};

type Fee = {
  code: string;               // '2.4'
  reference: string;          // 'подпункт 2.4 приложения № 1 к Положению'
  group: string;              // раздел списка действий
  name: string;
  wording: string;            // дословный текст пункта
  base: number;
  surcharges: { label: string; parameter: string; over: number; amount: number }[];
  parameters: string[];       // id параметров, которые нужно заполнить, по порядку
};

type FeeSchedule = FeeScheduleSummary & { note: string | null; parameters: FeeParameter[]; fees: Fee[] };
```

- `GET /api/fees` → `{ "items": FeeScheduleSummary[] }` в порядке вкладок.
- `GET /api/fees/:id` → `FeeSchedule`; неизвестный вид → `404 FEE_SCHEDULE_NOT_FOUND`.
- `POST /api/fees/:id/calculate` — тело `{ "fee": "2.4", "values": { … } }`, где ключи `values` — `id`
  параметров из `fee.parameters`: число для `number`, `true`/`false` для `yesNo`, массив чисел для
  `perClass` (по одному на каждый класс, длина равна значению `классы`).

```http
POST /api/fees/trademarks/calculate
Content-Type: application/json

{ "fee": "2.4", "values": { "классы": 3, "товары_в_классе": [15, 10, 4] } }
```

```json
{
  "schedule": { "id": "trademarks", "title": "Товарные знаки", "basis": "…", "effectiveFrom": "2025-10-04", "reviewedBy": null },
  "fee": { "code": "2.4", "reference": "подпункт 2.4 приложения № 1 к Положению", "name": "…", "wording": "…" },
  "total": 20500,
  "lines": [
    { "label": "Основная пошлина", "amount": 13000 },
    { "label": "За каждый класс МКТУ сверх первого", "units": 2, "unitAmount": 2500, "amount": 5000 },
    { "label": "За каждый товар или услугу сверх десяти в одном классе", "units": 5, "unitAmount": 500, "amount": 2500 }
  ]
}
```

Ошибки: `400 VALIDATION_ERROR` — неизвестный `fee` (поле `fee`), лишний, отсутствующий или неверный
параметр (поле `values.<id>`), число значений `perClass` не равно числу классов; `404 FEE_SCHEDULE_NOT_FOUND`.

## 11. Маршруты сайта и наполнение

API не знает адресов страниц сайта: id материалов и объектов постоянны, а маршруты определяет
фронтенд (`frontend/src/entities/material/model/routes.ts`): `checklist` → `/protect/code`,
`database-registration` → `/ownership/databases`, остальные материалы → `/articles/:id`;
объекты `code`, `databases`, `brand` → `/protect/...`, остальные → `/articles?topic=:id`.

Ссылки внутри текстов материалов (`TextRun.href`, начинающиеся с `/`) — это адреса страниц сайта.

## 12. CORS

- Разрешённые origin задаются в `backend/.env` переменной `FRONTEND_ORIGIN` — **списком через запятую**.
  По умолчанию в `.env.example`: `http://localhost:3000,http://127.0.0.1:3000`. Dev-сервер фронтенда
  и Playwright работают на `127.0.0.1:3000`, а в браузере часто открывают `localhost:3000` —
  для браузера это разные origin, поэтому разрешены оба.
- Origin указывается точно: схема, хост, порт, без пути и `/` в конце.
- Разрешены методы `GET, POST, PUT, PATCH, DELETE` и заголовки `Content-Type`, `Authorization`.
  Preflight (`OPTIONS`) отвечает `204` и кэшируется браузером на 10 минут.
- `credentials` **не включены**: cookies не используются. В `fetch` не нужно указывать `credentials: 'include'`.
- Запросы с других origin браузер блокирует; curl и Postman CORS не проверяют.

## 13. Соглашения: JSON, статусы, ошибки

### JSON

- Тела запросов и ответов — JSON в UTF-8, заголовок `Content-Type: application/json`.
- Максимальный размер тела запроса — 100 KB.
- Списки возвращаются в объекте: `{ "items": [...] }` — так в ответ можно будет добавить пагинацию без
  ломающих изменений.

### HTTP-статусы

| Статус | Когда |
| --- | --- |
| `200 OK` | Успешный запрос с телом ответа |
| `201 Created` | Создан ресурс (регистрация, запись истории) |
| `204 No Content` | Успех без тела (избранное, logout) |
| `400 Bad Request` | Невалидный JSON или данные (`INVALID_JSON`, `VALIDATION_ERROR`) |
| `401 Unauthorized` | Нет токена, он неверен или истёк; неверные логин или пароль |
| `403 Forbidden` | Зарезервирован на будущее: ролей и прав доступа пока нет |
| `404 Not Found` | Маршрут или ресурс не найден |
| `409 Conflict` | Логин или email уже заняты |
| `413 Payload Too Large` | Тело запроса больше 100 KB |
| `500 Internal Server Error` | Непредвиденная ошибка сервера |
| `503 Service Unavailable` | Недоступна БД (`DATABASE_UNAVAILABLE`) — можно повторить запрос позже |

### Формат ошибок

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Must be a valid email address" },
      { "field": "password", "message": "Length must be between 8 and 128 characters" }
    ]
  }
}
```

- `code` — стабильный машиночитаемый код, на него опирается логика фронтенда.
- `message` — описание на английском для разработчика. Не показывать пользователю как есть: тексты
  для интерфейса подбирает фронтенд по `code` и `details[].field`.
- `details` — только у `VALIDATION_ERROR`, перечисляет **все** найденные проблемы.
- Ответы не содержат stack trace, SQL и внутренних деталей.

### Коды ошибок

| Код | Статус | Причина |
| --- | --- | --- |
| `INVALID_JSON` | 400 | Тело не является валидным JSON |
| `BAD_REQUEST` | 400 | Прочие ошибки разбора запроса |
| `VALIDATION_ERROR` | 400 | Данные не прошли проверку; подробности в `details` |
| `AUTH_REQUIRED` | 401 | Нет заголовка `Authorization: Bearer ...` |
| `INVALID_TOKEN` | 401 | Access-токен поддельный, повреждён или его пользователь удалён |
| `TOKEN_EXPIRED` | 401 | Access-токен истёк — нужен `refresh` |
| `INVALID_CREDENTIALS` | 401 | Неверный логин/email или пароль |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh-токен неизвестен, истёк, отозван или уже использован |
| `NOT_FOUND` | 404 | Маршрут не найден |
| `MATERIAL_NOT_FOUND` | 404 | Материала с таким id нет |
| `FEE_SCHEDULE_NOT_FOUND` | 404 | Вида пошлин с таким id нет |
| `LOGIN_TAKEN` | 409 | Логин занят |
| `EMAIL_TAKEN` | 409 | Email уже зарегистрирован |
| `PAYLOAD_TOO_LARGE` | 413 | Тело запроса больше 100 KB |
| `INTERNAL_ERROR` | 500 | Непредвиденная ошибка сервера |
| `DATABASE_UNAVAILABLE` | 503 | PostgreSQL недоступен |

## 14. Наполнение и демо-данные

Команды выполняются в `backend/`:

- `npm run db:seed` — синхронизирует БД с папкой `content/`: 7 объектов защиты и 11 материалов
  (8 полных текстов и 3 анонса без текста: `application`, `deadlines`, `classes`). Запускается при
  каждом развёртывании и в CI. Записи, удалённые из `content/`, снимаются с публикации, но не удаляются.
  Той же командой из `content/fees/` загружаются суммы калькулятора пошлин.
- `npm run db:seed:demo` — только для разработки и CI: демо-пользователь из макета (логин
  `anna_kuznetsova`, email `anna@example.com`, имя «Анна Кузнецова», дата регистрации 12.10.2023)
  с тремя избранными материалами и шестью записями истории. Пароль — из `SEED_DEMO_PASSWORD`
  в `backend/.env`. С `NODE_ENV=production` команда не выполняется.

## 15. Не реализовано

- Подтверждение email и восстановление пароля — нет отправки писем.
- Смена пароля и удаление аккаунта из профиля.
- Хранение версии политики конфиденциальности, на которую дано согласие: сохраняется только время согласия.
- Ограничение частоты запросов (защита входа от перебора паролей).
- Инструменты, которые на фронтенде помечены «раздел готовится»: конструктор документов, проверка товарного знака, каталог юристов, оценка рисков, «Вопрос — ответ».
- Редактирование наполнения через API (админка). Наполнение меняется в `content/` и попадает в БД
  через `npm run db:seed`.
- Роли и права доступа (`403`).
