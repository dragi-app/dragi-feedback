# Dragi Feedback

Мобільна форма зворотного зв’язку для контенту Dragi.

## Запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

Приклад посилання:

```text
http://localhost:5173/?lang=uk&content_id=25439
```

Підтримувані параметри:

- `lang`: `uk` або `en`, невідомі значення використовують українську.
- `content_id`: ID матеріалу з застосунку.

## n8n

Готовий workflow та структура Google Sheets знаходяться в каталозі `n8n`.

## Rive

Анімація персонажа знаходиться у `public/dragi.riv`. Форма автоматично запускає першу state machine або першу timeline-анімацію. Якщо файл не завантажився, використовується `public/dragi.webp`. За ввімкненого системного налаштування зменшення руху показується статичний кадр.

## GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` автоматично збирає і публікує сайт з гілки `main`. Production webhook зберігається у `.env.production`. Його URL доступний браузеру під час надсилання, тому перевірка origin, валідація та rate limit мають виконуватися у n8n.

Для private-репозиторію GitHub Pages потрібен GitHub Pro, Team або Enterprise. Сам опублікований сайт є публічним, навіть якщо вихідний код приватний.
