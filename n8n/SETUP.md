# Dragi Feedback: налаштування n8n

## Швидкий прийом — версія 2.1

Одразу після `Feedback Webhook` виконується `Respond Success`: HTTP 200 із
`ok=true`, `accepted=true` та `execution_id`. Після відповіді той самий execution
продовжує чинні перевірки, завантаження аудіо в Drive та запис у Feedback.
Форма вже сумісна з HTTP 200; новий сервіс прийому не потрібний.

Для workflow явно ввімкнені `saveDataSuccessExecution=all`,
`saveDataErrorExecution=all` і `saveExecutionProgress=true`. У разі помилки
запису оператор може знайти execution та його початковий payload і binary audio.
HTTP 200 підтверджує прийом n8n; результат Google-операцій перевіряється в execution.
На перевіреному сервері 17.10.2026 глобальна історія автоматично очищується через
48 годин. Це чинне вікно відновлення з execution; його треба враховувати при
ручному розборі помилок. Перед повторною доставкою перевірити `feedback_id`
в Sheets та наявний audio file ID, щоб не дублювати вже виконані зовнішні записи.

Зміна зберігає чинний webhook URL, Google credentials, усі 28 колонок Feedback,
валідацію й обидві аудіогілки. Вона не додає автоматичних повторних доставок.

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
