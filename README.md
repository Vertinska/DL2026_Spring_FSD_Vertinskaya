## DL2026_Spring_FSD_Vertinskaya — Генератор QR-кодов с кастомизацией

Web-приложение на React (Vite) и Node.js/Express для генерации QR-кодов с кастомизацией:
цвета переднего плана/фона, размер QR, опциональный логотип (PNG/JPG/SVG) и опция "круглый логотип".

Поддерживаются форматы скачивания: **PNG** (логотип возможен) и **SVG** (векторный QR, без логотипа).

---

## Стек

- Backend: Node.js + Express
- Frontend: React + Vite
- Генерация QR: `qrcode`
- Наложение логотипа: `sharp`
- Загрузка файлов: `multer`
- MongoDB: используется для серверной истории QR-кодов (UI работает через API)

---

## Требования

- Node.js (рекомендуется 18+)
- npm
- MongoDB (по умолчанию `mongodb://127.0.0.1:27017/qr-generator`; при недоступности используется fallback-история в `localStorage`)
- Свободные порты:
  - frontend: `3000`
  - backend: `5000`

---

## Установка и запуск

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Сервер будет доступен на: `http://localhost:5000`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

UI доступен на: `http://localhost:3000`

> В `vite.config.js` настроен proxy для `/api` и `/uploads`.  
> Можно задать backend URL через `VITE_API_URL`.

---

## Использование (UI)

1. Введите текст или URL.
2. Настройте:
   - размер QR (100–1000 px),
   - цвет переднего плана (HEX),
   - цвет фона (HEX),
   - уровень коррекции (L/M/Q/H),
   - логотип (drag&drop) и **размер логотипа** (30–80 px),
   - чекбокс **"Круглый логотип"** (для PNG-режима),
   - формат результата: **PNG** или **SVG**.
3. Получите предпросмотр QR.
4. Нажмите:
   - **Скачать** (PNG/SVG),
   - **Поделиться** (копирует ссылку на сгенерированное изображение).
5. В истории можно выбрать сохранённую запись кнопкой **"Использовать"** (при этом QR в предпросмотре не перегенерируется).

---

## API

### `POST /api/generate-qr`

Тип: `multipart/form-data` (для логотипа).

Поля:
- `text` (string, required) — текст/URL для кодирования
- `size` (number, optional) — размер QR в пикселях (100–1000), default: 300
- `foregroundColor` (string, optional) — HEX цвет переднего плана, default: `#000000`
- `backgroundColor` (string, optional) — HEX цвет фона, default: `#FFFFFF`
- `errorCorrectionLevel` (string, optional) — `L | M | Q | H`, default: `M`
- `roundLogo` (boolean/string, optional) — для PNG, поддерживает `true/false` и `"true"/"false"`, default: `false`
- `logo` (file, optional) — логотип (поле name: `logo`)
- `logoSize` (number, optional) — размер логотипа в px (30–80), default: 50
- `format` (string, optional) — `png` (default) или `svg`

Ответ:
- при `format=png`: `Content-Type: image/png` и бинарные данные PNG
- при `format=svg`: `Content-Type: image/svg+xml` и строка SVG

Заголовки:
- `X-QR-Image-Path`: путь в `/uploads/...` (используется для кнопки "Поделиться" и скачивания по ссылке)

Ошибки:
- `400` — валидация входных данных (например, пустой `text`, неверный `size`, неправильные HEX, слишком похожие цвета, ошибки обработки логотипа)
- `500` — ошибка генерации/обработки изображения или сохранения

### `GET /api/test`

Проверка доступности API:
- `200` JSON: `{ ok: true, message: "..." }`

### `GET /api/history`

Получение истории QR-кодов из MongoDB:
- query: `limit` (optional, default `30`, max `100`)
- ответ: массив записей, отсортированный по `createdAt` по убыванию

### `DELETE /api/history/:id`

Удаление записи истории по `id`:
- `200` JSON: `{ success: true }`
- `404` если запись не найдена

---

## Примечания по истории

- По умолчанию UI получает историю через серверные endpoints `/api/history` и `/api/history/:id`.
- Если серверная история недоступна (например, MongoDB временно не подключена), UI автоматически переключается на fallback в `localStorage`.

---

## Где смотреть проектирование и AI-рефлексию

- `docs/design.md` — проектирование и требования
- `docs/AI_REFLECTION.md` — рефлексия по использованию AI

