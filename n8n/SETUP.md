# Dragi Feedback: налаштування n8n

## Надійний швидкий прийом — версія 2.3

Чинний шлях лишається `форма → n8n webhook → чинний feedback workflow`.
Для n8n 2.31.5 встановлено цільове розширення з `n8n/runtime/`, обмежене
workflow `0pwbPcx7RxRXCw0O`. Інші workflow використовують оригінальні методи.
Сам `responseMode=onReceived` у цій версії n8n ще чекає вільного execution slot,
тому одного налаштування Webhook недостатньо.

HTTP 200 тепер повертається після `fsync` квитанції, повного payload і резервної
копії аудіо в постійному сховищі n8n. Створення native execution у спільній базі,
очікування slot, валідація, Drive і Sheets виконуються у фоні. Відмова запису
квитанції повертає 503, без `accepted=true`. Відмова native DB після прийому
залишає квитанцію в черзі; n8n повторює створення execution після відновлення бази.

Відповідь: `ok=true`, `accepted=true`, `receipt_id`, `duplicate` та nullable
`execution_id`. До створення native execution `execution_id=null`; сталим
підтвердженням є `receipt_id`. Форма використовує HTTP status і не чекає Google.
Для повторної відправки незміненого чернеткового повідомлення форма зберігає
той самий `feedback_id`, timestamp, payload і аудіо після мережевої помилки.

Дедуплікація використовує `feedback_id` і SHA-256 вмісту. Однаковий запит
повертає попередню квитанцію без нового execution. Той самий ID з іншим текстом
або аудіо повертає 409. Native unique `deduplicationKey` додатково захищає
створення execution після збою між DB commit та оновленням квитанції.

За замовчуванням квитанції лежать у
`/home/node/.n8n/dragi-feedback-receipts-v1/<sha256(feedback_id)>/`: приватний
`receipt.json` містить payload і snapshot, `<sha256(audio)>.audio` — резервне
аудіо. Це той самий постійний volume n8n, без окремого інстансу або сервісу.
Квитанції не підпадають під глобальне очищення execution через 48 годин;
їх не слід видаляти разом з execution, бо вони забезпечують тривалу дедуплікацію.

Після перезапуску n8n підбирає квитанції `dispatch_state=admitted`. Native
execution зі статусом `new` отримує slot і змінює стан через умовний запис
`new → running`; одне виконання не може бути запущене двічі. Виконання, що вже
почалося, не повторюється автоматично: результат Google-запису міг бути
невідомим. Якщо раніше призначений execution вже очищений, квитанція отримує
`needs_review`, без нового виконання. Сирі текст і аудіо лишаються для звірки.
Перед ручним повтором перевіряти `feedback_id` у Feedback і наявний audio file ID
у Drive. `dispatched` означає передавання на виконання, а не успіх Google.
Handled error може залишати загальний статус execution `success` — перевіряти ноди.

Перевірено на ізольованому n8n 2.31.5 (0,75 CPU, 768 MiB, concurrency 2):
107 підтверджених HTTP-запитів, 75 унікальних фідбеків, 44 з аудіо; усі
підтвердження до секунди, максимум 0,697 с. Перевірки включали заповнені slots,
32 повтори з паралельним надсиланням, аудіо 5 MiB, відмови DB/receipt store, SIGKILL, звичайний
перезапуск, відновлення з резервного аудіо та дедуплікацію після очищення execution.
Downstream side effect у тестовому приймачі відбувся рівно один раз на feedback_id.
Час передачі аудіо через публічну мережу залежить від з'єднання користувача.
Тестових записів у виробничі Sheets/Drive не виконували; production перевірено
за checksum, незмінністю всіх workflow versions і відсутністю перезапуску.

Розгортання 17.10.2026 виконано без перезапуску основного n8n. Для наступного
відтворення контейнера налаштовано образ `n8n-custom:2.31.5-feedback-receipts-v1`.
Розширення прив'язане до точних checksum n8n 2.31.5: іншу версію не патчити
без повторної перевірки. Builder лише створює артефакти, не змінює інсталяцію:

```bash
python3 n8n/runtime/build_runtime.py --n8n-dist /path/to/pristine/dist --output /tmp/feedback-runtime
```

Google credentials, webhook URL, 28 колонок, native graph, валідація й аудіогілки
збережені. Для workflow лишаються `saveDataSuccessExecution=all`,
`saveDataErrorExecution=all`, `saveExecutionProgress=true` та чинний error workflow.

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
