# Dragi Feedback: налаштування n8n

1. Створіть Google Sheet з аркушем `Feedback`.
2. Скопіюйте перший рядок із `Feedback_sheet_headers.csv` у перший рядок аркуша без перейменувань.
3. Створіть окрему непублічну папку Google Drive для голосових повідомлень.
4. Імпортуйте `Dragi_Feedback_Intake.json` у n8n.
5. У ноді `Feedback Configuration` вкажіть Google Sheet ID, назву аркуша і Google Drive folder ID.
6. У нодах Google Sheets і Google Drive виберіть відповідні credentials.
7. Запустіть тестовий webhook, а після перевірки активуйте workflow.

Workflow приймає `multipart/form-data`:

- `payload`: JSON-рядок із даними форми.
- `audio`: необов’язковий binary-файл до 5 МБ.

У Google Sheets кожне нове звернення отримує статус `NEW`. Якщо завантаження аудіо не вдалося, текстовий фідбек все одно зберігається зі статусом `audio_status=UPLOAD_FAILED`.

Версія 2 додає колонки `content_type` і `video_timestamp`. Якщо workflow уже працює, додайте ці заголовки в Google Sheet, після чого оновіть ноди `Normalize & Validate` та `Append Feedback to Sheets` з файлу `Dragi_Feedback_Intake.json` і повторно опублікуйте workflow.

Підтримувані `content_type`: `video`, `exercisetest`, `exercisematching`, `exerciseopen`, `general`. Підтримувані мови: `uk`, `en`, `es`, `de`.
