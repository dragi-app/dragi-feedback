"use client";

import {
  Check,
  FileText,
  ImageIcon,
  ListChecks,
  Mail,
  MessageCircleMore,
  Mic,
  RotateCcw,
  Send,
  Square,
  Trash2,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRive } from "@rive-app/react-canvas";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Lang = "uk" | "en";
type IssueId =
  | "audio"
  | "visual"
  | "content"
  | "exercise"
  | "technical"
  | "other";

type QueryContext = {
  lang: Lang;
  contentId: string;
};

type IssueDefinition = {
  id: IssueId;
  code: string;
  icon: LucideIcon;
  label: Record<Lang, string>;
  details: Array<{
    code: string;
    label: Record<Lang, string>;
  }>;
};

const COPY = {
  uk: {
    eyebrow: "DRAGI FEEDBACK",
    title: "Повідомити про проблему",
    intro:
      "Оберіть, що саме потребує виправлення. Деталі можна додати за бажанням.",
    material: "Матеріал",
    unknownMaterial: "Загальний відгук",
    categoryLabel: "Категорія проблеми",
    detailTitle: "Що саме сталося?",
    detailOptional: "Необов’язково",
    descriptionLabel: "Додаткові деталі",
    descriptionPlaceholder: "Коротко опишіть, що потрібно перевірити",
    voiceTitle: "Голосове повідомлення",
    voiceHint: "До 60 секунд",
    record: "Записати",
    stop: "Зупинити",
    remove: "Видалити запис",
    emailLabel: "Email для відповіді",
    emailHint: "Необов’язково. Тільки якщо можна з вами зв’язатися.",
    emailPlaceholder: "name@example.com",
    submit: "Надіслати",
    sending: "Надсилаємо...",
    selectIssue: "Спочатку оберіть категорію",
    otherNeedsDetails:
      "Для категорії «Інше» додайте текст або голосове повідомлення.",
    audioUnsupported: "Цей браузер не підтримує запис аудіо.",
    microphoneDenied: "Не вдалося отримати доступ до мікрофона.",
    submitError: "Не вдалося надіслати. Спробуйте ще раз.",
    successTitle: "Дякуємо. Повідомлення отримано.",
    successText:
      "Ми зберегли контекст матеріалу, тому зможемо швидко перевірити проблему.",
    sendAnother: "Повідомити ще",
    demo: "Демонстраційний режим: дані поки не передаються у n8n.",
    characters: "символів",
  },
  en: {
    eyebrow: "DRAGI FEEDBACK",
    title: "Report a problem",
    intro:
      "Choose what needs attention. You can add more details if you want.",
    material: "Content",
    unknownMaterial: "General feedback",
    categoryLabel: "Problem category",
    detailTitle: "What happened?",
    detailOptional: "Optional",
    descriptionLabel: "Additional details",
    descriptionPlaceholder: "Briefly describe what we should check",
    voiceTitle: "Voice message",
    voiceHint: "Up to 60 seconds",
    record: "Record",
    stop: "Stop",
    remove: "Delete recording",
    emailLabel: "Email for a reply",
    emailHint: "Optional. Only if we may contact you.",
    emailPlaceholder: "name@example.com",
    submit: "Send",
    sending: "Sending...",
    selectIssue: "Choose a category first",
    otherNeedsDetails: "Add text or a voice message for the Other category.",
    audioUnsupported: "Audio recording is not supported by this browser.",
    microphoneDenied: "Microphone access was not granted.",
    submitError: "Could not send your feedback. Please try again.",
    successTitle: "Thank you. Your report was received.",
    successText:
      "We saved the content context, so the problem can be checked quickly.",
    sendAnother: "Send another report",
    demo: "Demo mode: data is not being sent to n8n yet.",
    characters: "characters",
  },
} satisfies Record<Lang, Record<string, string>>;

const ISSUES: IssueDefinition[] = [
  {
    id: "audio",
    code: "AUDIO",
    icon: Volume2,
    label: { uk: "Звук та озвучення", en: "Audio or voiceover" },
    details: [
      { code: "AUDIO_MISSING", label: { uk: "Немає звуку", en: "No sound" } },
      { code: "AUDIO_QUALITY", label: { uk: "Погана якість", en: "Poor quality" } },
      { code: "AUDIO_WRONG_VOICEOVER", label: { uk: "Помилка в озвученні", en: "Wrong voiceover" } },
      { code: "AUDIO_PRONUNCIATION", label: { uk: "Вимова або мова", en: "Pronunciation or language" } },
      { code: "AUDIO_SYNC", label: { uk: "Не збігається з відео", en: "Out of sync" } },
    ],
  },
  {
    id: "visual",
    code: "VISUAL",
    icon: ImageIcon,
    label: { uk: "Візуальне відображення", en: "Visual display" },
    details: [
      { code: "VISUAL_MISSING", label: { uk: "Не відображається", en: "Not displayed" } },
      { code: "VISUAL_WRONG", label: { uk: "Неправильне зображення", en: "Wrong image" } },
      { code: "VISUAL_CROP", label: { uk: "Обрізано або перекрито", en: "Cropped or covered" } },
      { code: "VISUAL_QUALITY", label: { uk: "Погана якість", en: "Poor quality" } },
      { code: "VISUAL_ANIMATION", label: { uk: "Помилка анімації", en: "Animation problem" } },
    ],
  },
  {
    id: "content",
    code: "CONTENT",
    icon: FileText,
    label: { uk: "Текст і зміст", en: "Text and content" },
    details: [
      { code: "CONTENT_TYPO", label: { uk: "Помилка в тексті", en: "Text error" } },
      { code: "CONTENT_TRANSLATION", label: { uk: "Помилка перекладу", en: "Translation error" } },
      { code: "CONTENT_EXPLANATION", label: { uk: "Неточне пояснення", en: "Incorrect explanation" } },
      { code: "CONTENT_GRAMMAR", label: { uk: "Граматика або факт", en: "Grammar or fact" } },
    ],
  },
  {
    id: "exercise",
    code: "EXERCISE",
    icon: ListChecks,
    label: { uk: "Завдання або відповідь", en: "Task or answer" },
    details: [
      { code: "EXERCISE_INSTRUCTION", label: { uk: "Умова завдання", en: "Task instruction" } },
      { code: "EXERCISE_OPTIONS", label: { uk: "Варіанти відповіді", en: "Answer options" } },
      { code: "EXERCISE_CORRECT_ANSWER", label: { uk: "Правильна відповідь", en: "Correct answer" } },
      { code: "EXERCISE_VALIDATION", label: { uk: "Перевірка відповіді", en: "Answer validation" } },
    ],
  },
  {
    id: "technical",
    code: "TECHNICAL",
    icon: TriangleAlert,
    label: { uk: "Технічна проблема", en: "Technical problem" },
    details: [
      { code: "TECHNICAL_LOADING", label: { uk: "Не завантажується", en: "Does not load" } },
      { code: "TECHNICAL_FREEZE", label: { uk: "Зависає", en: "Freezes" } },
      { code: "TECHNICAL_CONTROL", label: { uk: "Кнопка не працює", en: "Control does not work" } },
      { code: "TECHNICAL_PROGRESS", label: { uk: "Не зберігає прогрес", en: "Progress not saved" } },
    ],
  },
  {
    id: "other",
    code: "OTHER",
    icon: MessageCircleMore,
    label: { uk: "Інше", en: "Other" },
    details: [],
  },
];

const BASE_URL = import.meta.env.BASE_URL || "./";
const WEBHOOK_URL = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL?.trim();

function readQueryContext(): QueryContext {
  if (typeof window === "undefined") {
    return { lang: "uk", contentId: "" };
  }

  const params = new URLSearchParams(window.location.search);
  let rawLang = params.get("lang") || "uk";
  let contentId = params.get("content_id") || "";

  // Also accepts the temporary legacy format: ?lang=uk?content_id=25439
  if (!contentId && rawLang.includes("?")) {
    const [langPart, legacyQuery = ""] = rawLang.split("?", 2);
    rawLang = langPart;
    contentId = new URLSearchParams(legacyQuery).get("content_id") || "";
  }

  const normalizedLang = rawLang.toLowerCase().split("-")[0];
  const lang: Lang = normalizedLang === "en" ? "en" : "uk";

  return {
    lang,
    contentId: contentId.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120),
  };
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function createFeedbackId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function RiveMascot({
  onReady,
  onError,
}: {
  onReady: () => void;
  onError: () => void;
}) {
  const { RiveComponent } = useRive({
    src: `${BASE_URL}dragi.riv`,
    autoplay: false,
    shouldDisableRiveListeners: true,
    isTouchScrollEnabled: true,
    onRiveReady: (rive) => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (!reduceMotion) {
        const animation = rive.stateMachineNames[0] || rive.animationNames[0];
        if (animation) rive.play(animation);
      }

      onReady();
    },
    onLoadError: onError,
  });

  return <RiveComponent aria-hidden="true" />;
}

function Mascot({ lang }: { lang: Lang }) {
  const [riveLoaded, setRiveLoaded] = useState(false);
  const [riveFailed, setRiveFailed] = useState(false);

  return (
    <div className="mascot-frame" aria-label={lang === "uk" ? "Драгі" : "Dragi"}>
      <img
        className={`mascot-fallback ${riveLoaded ? "mascot-fallback-hidden" : ""}`}
        src={`${BASE_URL}dragi.webp`}
        alt=""
      />
      {!riveFailed && (
        <div className={`mascot-rive ${riveLoaded ? "mascot-rive-visible" : ""}`}>
          <RiveMascot
            onReady={() => setRiveLoaded(true)}
            onError={() => setRiveFailed(true)}
          />
        </div>
      )}
    </div>
  );
}

export default function FeedbackForm() {
  const [context, setContext] = useState<QueryContext>({ lang: "uk", contentId: "" });
  const [selectedIssue, setSelectedIssue] = useState<IssueId | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [demoSubmission, setDemoSubmission] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef(0);

  useEffect(() => {
    const queryContext = readQueryContext();
    document.documentElement.lang = queryContext.lang;
    const frame = window.requestAnimationFrame(() => setContext(queryContext));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const copy = COPY[context.lang];
  const issue = useMemo(
    () => ISSUES.find((item) => item.id === selectedIssue) || null,
    [selectedIssue],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      const elapsed = Math.min(
        60,
        Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
      );
      setRecordingSeconds(elapsed);
      if (elapsed >= 60) stopRecording();
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [audioUrl]);

  async function startRecording() {
    setAudioError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError(copy.audioUnsupported);
      return;
    }

    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
      setRecordingSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
    } catch {
      setAudioError(copy.microphoneDenied);
      setIsRecording(false);
    }
  }

  function removeAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingSeconds(0);
    setAudioError("");
  }

  function resetForm() {
    setSelectedIssue(null);
    setSelectedDetail(null);
    setDescription("");
    setEmail("");
    removeAudio();
    setFormError("");
    setIsSubmitted(false);
    setDemoSubmission(false);
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!issue) {
      setFormError(copy.selectIssue);
      return;
    }

    if (issue.id === "other" && !description.trim() && !audioBlob) {
      setFormError(copy.otherNeedsDetails);
      return;
    }

    setIsSubmitting(true);

    const feedbackId = createFeedbackId();
    const payload = {
      schema_version: 1,
      feedback_id: feedbackId,
      client_created_at: new Date().toISOString(),
      ui_lang: context.lang,
      content_id: context.contentId || null,
      issue_category: issue.code,
      issue_code: selectedDetail || `${issue.code}_GENERAL`,
      description: description.trim() || null,
      email: email.trim() || null,
      audio: audioBlob
        ? { mime_type: audioBlob.type, size_bytes: audioBlob.size, duration_seconds: recordingSeconds }
        : null,
      page_context: {
        path: window.location.pathname,
        user_agent: navigator.userAgent,
      },
    };

    try {
      if (WEBHOOK_URL) {
        const data = new FormData();
        data.append("payload", JSON.stringify(payload));
        if (audioBlob) data.append("audio", audioBlob, `${feedbackId}.audio`);

        const response = await fetch(WEBHOOK_URL, {
          method: "POST",
          body: data,
        });

        if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
        setDemoSubmission(false);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        setDemoSubmission(true);
      }

      setIsSubmitted(true);
    } catch {
      setFormError(copy.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <main className="feedback-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="success-card" aria-live="polite">
          <div className="success-mark">
            <Check aria-hidden="true" />
          </div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.successTitle}</h1>
          <p>{copy.successText}</p>
          {context.contentId && (
            <span className="material-pill">
              {copy.material} #{context.contentId}
            </span>
          )}
          {demoSubmission && <p className="demo-note">{copy.demo}</p>}
          <button className="secondary-action" type="button" onClick={resetForm}>
            <RotateCcw size={18} aria-hidden="true" />
            {copy.sendAnother}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="feedback-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="feedback-card">
        <Mascot lang={context.lang} />

        <header className="form-header">
          <div className="header-meta">
            <p className="eyebrow">{copy.eyebrow}</p>
            <span className="material-pill">
              {context.contentId
                ? `${copy.material} #${context.contentId}`
                : copy.unknownMaterial}
            </span>
          </div>
          <h1>{copy.title}</h1>
          <p className="intro">{copy.intro}</p>
        </header>

        <form onSubmit={submitFeedback}>
          <fieldset className="category-fieldset">
            <legend>{copy.categoryLabel}</legend>
            <div className="category-grid">
              {ISSUES.map((item) => {
                const Icon = item.icon;
                const selected = selectedIssue === item.id;
                return (
                  <button
                    className={`category-card ${selected ? "category-card-selected" : ""}`}
                    type="button"
                    key={item.id}
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedIssue(item.id);
                      setSelectedDetail(null);
                      setFormError("");
                    }}
                  >
                    <span className="category-icon">
                      <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span>{item.label[context.lang]}</span>
                    {selected && (
                      <span className="selected-check">
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {issue && (
            <div className="details-panel">
              {issue.details.length > 0 && (
                <section className="detail-section" aria-labelledby="detail-title">
                  <div className="section-heading">
                    <h2 id="detail-title">{copy.detailTitle}</h2>
                    <span>{copy.detailOptional}</span>
                  </div>
                  <div className="detail-chips">
                    {issue.details.map((detail) => (
                      <button
                        key={detail.code}
                        className={`detail-chip ${selectedDetail === detail.code ? "detail-chip-selected" : ""}`}
                        type="button"
                        aria-pressed={selectedDetail === detail.code}
                        onClick={() =>
                          setSelectedDetail((current) =>
                            current === detail.code ? null : detail.code,
                          )
                        }
                      >
                        {detail.label[context.lang]}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="detail-section">
                <label className="field-label" htmlFor="feedback-description">
                  {copy.descriptionLabel}
                  <span>{copy.detailOptional}</span>
                </label>
                <textarea
                  id="feedback-description"
                  value={description}
                  maxLength={1200}
                  rows={4}
                  placeholder={copy.descriptionPlaceholder}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <p className="character-count">
                  {description.length}/1200 {copy.characters}
                </p>
              </section>

              <section className="detail-section audio-section">
                <div className="section-heading">
                  <div>
                    <h2>{copy.voiceTitle}</h2>
                    <p>{copy.voiceHint}</p>
                  </div>
                  <span>{copy.detailOptional}</span>
                </div>

                {!audioUrl ? (
                  <button
                    className={`record-button ${isRecording ? "record-button-active" : ""}`}
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <Square size={17} fill="currentColor" aria-hidden="true" />
                    ) : (
                      <Mic size={19} aria-hidden="true" />
                    )}
                    <span>{isRecording ? copy.stop : copy.record}</span>
                    {isRecording && <strong>{formatDuration(recordingSeconds)}</strong>}
                  </button>
                ) : (
                  <div className="audio-preview">
                    <audio controls src={audioUrl} />
                    <button type="button" onClick={removeAudio} aria-label={copy.remove}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {audioError && <p className="inline-error">{audioError}</p>}
              </section>

              <section className="detail-section contact-section">
                <label className="field-label" htmlFor="feedback-email">
                  <span className="label-with-icon">
                    <Mail size={17} aria-hidden="true" />
                    {copy.emailLabel}
                  </span>
                  <span>{copy.detailOptional}</span>
                </label>
                <p className="field-hint">{copy.emailHint}</p>
                <input
                  id="feedback-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  maxLength={254}
                  placeholder={copy.emailPlaceholder}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </section>
            </div>
          )}

          <div className="submit-area">
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button
              className="submit-button"
              type="submit"
              disabled={!selectedIssue || isSubmitting || isRecording}
            >
              <Send size={19} aria-hidden="true" />
              {isSubmitting ? copy.sending : copy.submit}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
