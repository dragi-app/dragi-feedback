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

type Lang = "uk" | "en" | "es" | "de";
type ContentType =
  | "video"
  | "exercisetest"
  | "exercisematching"
  | "exerciseopen"
  | "general";
type IssueCategory =
  | "AUDIO"
  | "VISUAL"
  | "CONTENT"
  | "EXERCISE"
  | "TECHNICAL"
  | "OTHER";
type LocalizedText = Record<Lang, string>;

type QueryContext = {
  lang: Lang;
  contentId: string;
  contentType: ContentType;
};

type IssueDefinition = {
  code: string;
  category: IssueCategory;
  icon: LucideIcon;
  label: LocalizedText;
};

const t = (uk: string, en: string, es: string, de: string): LocalizedText => ({
  uk,
  en,
  es,
  de,
});

const COPY = {
  uk: {
    eyebrow: "DRAGI FEEDBACK",
    material: "Матеріал",
    problemLabel: "Що саме сталося?",
    descriptionLabel: "Додаткові деталі",
    descriptionPlaceholder: "Коротко опишіть, що потрібно перевірити",
    timestampLabel: "Час у відео",
    timestampPlaceholder: "Наприклад, 01:23",
    timestampHint: "Якщо проблема виникла у конкретний момент",
    voiceTitle: "Голосове повідомлення",
    voiceHint: "До 60 секунд",
    record: "Записати",
    stop: "Зупинити",
    remove: "Видалити запис",
    emailLabel: "Email для відповіді",
    emailHint: "Залиште, лише якщо можна з вами зв’язатися.",
    emailPlaceholder: "name@example.com",
    optional: "Необов’язково",
    required: "Обов’язково",
    submit: "Надіслати",
    sending: "Надсилаємо...",
    selectIssue: "Оберіть, що саме сталося",
    otherNeedsDetails: "Для варіанта «Інше» додайте текст або голосове повідомлення.",
    audioUnsupported: "Цей браузер не підтримує запис аудіо.",
    microphoneDenied: "Не вдалося отримати доступ до мікрофона.",
    submitError: "Не вдалося надіслати. Спробуйте ще раз.",
    successTitle: "Дякуємо. Повідомлення отримано.",
    successText: "Ми зберегли контекст матеріалу й зможемо швидко перевірити проблему.",
    sendAnother: "Повідомити ще",
    demo: "Демонстраційний режим: дані поки не передаються у n8n.",
    characters: "символів",
    urgentSupport: "Термінова проблема з підпискою або оплатою?",
    supportEmail: "Написати на email",
    supportTelegram: "Telegram",
  },
  en: {
    eyebrow: "DRAGI FEEDBACK",
    material: "Content",
    problemLabel: "What exactly happened?",
    descriptionLabel: "Additional details",
    descriptionPlaceholder: "Briefly describe what we should check",
    timestampLabel: "Time in the video",
    timestampPlaceholder: "For example, 01:23",
    timestampHint: "If the problem occurs at a specific moment",
    voiceTitle: "Voice message",
    voiceHint: "Up to 60 seconds",
    record: "Record",
    stop: "Stop",
    remove: "Delete recording",
    emailLabel: "Email for a reply",
    emailHint: "Leave it only if we may contact you.",
    emailPlaceholder: "name@example.com",
    optional: "Optional",
    required: "Required",
    submit: "Send",
    sending: "Sending...",
    selectIssue: "Choose what happened",
    otherNeedsDetails: "For Other, add text or a voice message.",
    audioUnsupported: "Audio recording is not supported by this browser.",
    microphoneDenied: "Microphone access was not granted.",
    submitError: "Could not send your feedback. Please try again.",
    successTitle: "Thank you. Your report was received.",
    successText: "We saved the content context so the problem can be checked quickly.",
    sendAnother: "Send another report",
    demo: "Demo mode: data is not being sent to n8n yet.",
    characters: "characters",
    urgentSupport: "Urgent subscription or payment problem?",
    supportEmail: "Email us",
    supportTelegram: "Telegram",
  },
  es: {
    eyebrow: "DRAGI FEEDBACK",
    material: "Contenido",
    problemLabel: "¿Qué ha ocurrido exactamente?",
    descriptionLabel: "Detalles adicionales",
    descriptionPlaceholder: "Describe brevemente qué debemos revisar",
    timestampLabel: "Momento del vídeo",
    timestampPlaceholder: "Por ejemplo, 01:23",
    timestampHint: "Si el problema aparece en un momento concreto",
    voiceTitle: "Mensaje de voz",
    voiceHint: "Hasta 60 segundos",
    record: "Grabar",
    stop: "Detener",
    remove: "Eliminar grabación",
    emailLabel: "Email para responder",
    emailHint: "Déjalo solo si podemos contactarte.",
    emailPlaceholder: "nombre@ejemplo.com",
    optional: "Opcional",
    required: "Obligatorio",
    submit: "Enviar",
    sending: "Enviando...",
    selectIssue: "Elige qué ha ocurrido",
    otherNeedsDetails: "Para «Otro», añade texto o un mensaje de voz.",
    audioUnsupported: "Este navegador no permite grabar audio.",
    microphoneDenied: "No se ha podido acceder al micrófono.",
    submitError: "No se ha podido enviar. Inténtalo de nuevo.",
    successTitle: "Gracias. Hemos recibido tu mensaje.",
    successText: "Hemos guardado el contexto para revisar el problema rápidamente.",
    sendAnother: "Enviar otro mensaje",
    demo: "Modo de demostración: los datos todavía no se envían a n8n.",
    characters: "caracteres",
    urgentSupport: "¿Problema urgente con la suscripción o el pago?",
    supportEmail: "Escríbenos",
    supportTelegram: "Telegram",
  },
  de: {
    eyebrow: "DRAGI FEEDBACK",
    material: "Inhalt",
    problemLabel: "Was genau ist passiert?",
    descriptionLabel: "Zusätzliche Details",
    descriptionPlaceholder: "Beschreibe kurz, was wir prüfen sollen",
    timestampLabel: "Zeitpunkt im Video",
    timestampPlaceholder: "Zum Beispiel 01:23",
    timestampHint: "Falls das Problem an einer bestimmten Stelle auftritt",
    voiceTitle: "Sprachnachricht",
    voiceHint: "Bis zu 60 Sekunden",
    record: "Aufnehmen",
    stop: "Stoppen",
    remove: "Aufnahme löschen",
    emailLabel: "E-Mail für eine Antwort",
    emailHint: "Nur angeben, wenn wir dich kontaktieren dürfen.",
    emailPlaceholder: "name@beispiel.de",
    optional: "Optional",
    required: "Erforderlich",
    submit: "Senden",
    sending: "Wird gesendet...",
    selectIssue: "Wähle aus, was passiert ist",
    otherNeedsDetails: "Füge bei „Sonstiges“ Text oder eine Sprachnachricht hinzu.",
    audioUnsupported: "Dieser Browser unterstützt keine Audioaufnahme.",
    microphoneDenied: "Der Zugriff auf das Mikrofon wurde nicht erlaubt.",
    submitError: "Senden fehlgeschlagen. Bitte versuche es erneut.",
    successTitle: "Danke. Deine Meldung ist eingegangen.",
    successText: "Wir haben den Kontext gespeichert und können das Problem schnell prüfen.",
    sendAnother: "Weitere Meldung senden",
    demo: "Demo-Modus: Die Daten werden noch nicht an n8n gesendet.",
    characters: "Zeichen",
    urgentSupport: "Dringendes Problem mit Abo oder Zahlung?",
    supportEmail: "E-Mail senden",
    supportTelegram: "Telegram",
  },
} satisfies Record<Lang, Record<string, string>>;

const CONTENT_COPY: Record<
  ContentType,
  { label: LocalizedText; title: LocalizedText; intro: LocalizedText }
> = {
  video: {
    label: t("Відео", "Video", "Vídeo", "Video"),
    title: t("Що сталося з відео?", "What happened with the video?", "¿Qué ha ocurrido con el vídeo?", "Was ist mit dem Video passiert?"),
    intro: t("Оберіть проблему — за потреби додайте деталі.", "Choose the problem and add details if needed.", "Elige el problema y añade detalles si hace falta.", "Wähle das Problem und ergänze bei Bedarf Details."),
  },
  exercisetest: {
    label: t("Тестова вправа", "Test exercise", "Ejercicio tipo test", "Testaufgabe"),
    title: t("Що сталося у вправі?", "What happened in the exercise?", "¿Qué ha ocurrido en el ejercicio?", "Was ist bei der Aufgabe passiert?"),
    intro: t("Оберіть конкретну проблему — решта полів необов’язкові.", "Choose the exact problem. The remaining fields are optional.", "Elige el problema exacto. Los demás campos son opcionales.", "Wähle das genaue Problem. Alle weiteren Felder sind optional."),
  },
  exercisematching: {
    label: t("Вправа на відповідність", "Matching exercise", "Ejercicio de asociación", "Zuordnungsaufgabe"),
    title: t("Що сталося у вправі?", "What happened in the exercise?", "¿Qué ha ocurrido en el ejercicio?", "Was ist bei der Aufgabe passiert?"),
    intro: t("Оберіть конкретну проблему — решта полів необов’язкові.", "Choose the exact problem. The remaining fields are optional.", "Elige el problema exacto. Los demás campos son opcionales.", "Wähle das genaue Problem. Alle weiteren Felder sind optional."),
  },
  exerciseopen: {
    label: t("Вправа з відкритою відповіддю", "Open-answer exercise", "Ejercicio de respuesta abierta", "Aufgabe mit offener Antwort"),
    title: t("Що сталося у вправі?", "What happened in the exercise?", "¿Qué ha ocurrido en el ejercicio?", "Was ist bei der Aufgabe passiert?"),
    intro: t("Оберіть конкретну проблему — решта полів необов’язкові.", "Choose the exact problem. The remaining fields are optional.", "Elige el problema exacto. Los demás campos son opcionales.", "Wähle das genaue Problem. Alle weiteren Felder sind optional."),
  },
  general: {
    label: t("Загальний відгук", "General feedback", "Comentario general", "Allgemeines Feedback"),
    title: t("Повідомити про проблему", "Report a problem", "Informar de un problema", "Problem melden"),
    intro: t("Оберіть найближчий варіант або залиште загальний відгук.", "Choose the closest option or leave general feedback.", "Elige la opción más adecuada o deja un comentario general.", "Wähle die passende Option oder hinterlasse allgemeines Feedback."),
  },
};

const otherIssue: IssueDefinition = {
  code: "OTHER_GENERAL",
  category: "OTHER",
  icon: MessageCircleMore,
  label: t("Інше", "Other", "Otro", "Sonstiges"),
};

const ISSUES_BY_CONTENT_TYPE: Record<ContentType, IssueDefinition[]> = {
  video: [
    { code: "AUDIO_MISSING", category: "AUDIO", icon: Volume2, label: t("Немає звуку", "No sound", "No hay sonido", "Kein Ton") },
    { code: "AUDIO_QUALITY", category: "AUDIO", icon: Volume2, label: t("Погана якість звуку", "Poor sound quality", "Mala calidad de sonido", "Schlechte Tonqualität") },
    { code: "AUDIO_WRONG_VOICEOVER", category: "AUDIO", icon: Volume2, label: t("Помилка в озвученні", "Voiceover error", "Error en la locución", "Fehler in der Vertonung") },
    { code: "VISUAL_PLAYBACK", category: "VISUAL", icon: ImageIcon, label: t("Проблема із зображенням", "Video display problem", "Problema de imagen", "Problem mit der Darstellung") },
    { code: "TECHNICAL_LOADING", category: "TECHNICAL", icon: TriangleAlert, label: t("Відео не завантажується", "Video does not load", "El vídeo no carga", "Video lädt nicht") },
    { code: "CONTENT_INCORRECT", category: "CONTENT", icon: FileText, label: t("Помилка у змісті", "Content error", "Error en el contenido", "Inhaltlicher Fehler") },
    { code: "CONTENT_SUBTITLES", category: "CONTENT", icon: FileText, label: t("Помилка в тексті або субтитрах", "Text or subtitle error", "Error en texto o subtítulos", "Fehler in Text oder Untertiteln") },
    otherIssue,
  ],
  exercisetest: [
    { code: "EXERCISE_INSTRUCTION", category: "EXERCISE", icon: ListChecks, label: t("Помилка в умові", "Task instruction error", "Error en el enunciado", "Fehler in der Aufgabenstellung") },
    { code: "EXERCISE_OPTIONS", category: "EXERCISE", icon: ListChecks, label: t("Проблема у варіантах відповіді", "Problem with answer options", "Problema con las opciones", "Problem mit den Antwortoptionen") },
    { code: "EXERCISE_CORRECT_ANSWER", category: "EXERCISE", icon: ListChecks, label: t("Неправильна правильна відповідь", "Wrong correct answer", "Respuesta correcta incorrecta", "Falsche richtige Antwort") },
    { code: "CONTENT_EXPLANATION", category: "CONTENT", icon: FileText, label: t("Помилка в поясненні", "Explanation error", "Error en la explicación", "Fehler in der Erklärung") },
    { code: "VISUAL_MISSING", category: "VISUAL", icon: ImageIcon, label: t("Проблема із зображенням", "Image problem", "Problema con la imagen", "Problem mit dem Bild") },
    { code: "TECHNICAL_CONTROL", category: "TECHNICAL", icon: TriangleAlert, label: t("Відповідь або кнопка не працює", "Answer or button does not work", "La respuesta o el botón no funciona", "Antwort oder Schaltfläche funktioniert nicht") },
    otherIssue,
  ],
  exercisematching: [
    { code: "EXERCISE_INSTRUCTION", category: "EXERCISE", icon: ListChecks, label: t("Помилка в умові", "Task instruction error", "Error en el enunciado", "Fehler in der Aufgabenstellung") },
    { code: "EXERCISE_MATCHING_PAIRS", category: "EXERCISE", icon: ListChecks, label: t("Неправильні пари", "Incorrect pairs", "Pares incorrectos", "Falsche Paare") },
    { code: "EXERCISE_MATCHING_CONTROL", category: "EXERCISE", icon: ListChecks, label: t("Не працює зіставлення", "Matching does not work", "La asociación no funciona", "Zuordnung funktioniert nicht") },
    { code: "CONTENT_EXPLANATION", category: "CONTENT", icon: FileText, label: t("Помилка в поясненні", "Explanation error", "Error en la explicación", "Fehler in der Erklärung") },
    { code: "VISUAL_MISSING", category: "VISUAL", icon: ImageIcon, label: t("Проблема із зображенням", "Image problem", "Problema con la imagen", "Problem mit dem Bild") },
    { code: "TECHNICAL_LOADING", category: "TECHNICAL", icon: TriangleAlert, label: t("Вправа не завантажується", "Exercise does not load", "El ejercicio no carga", "Aufgabe lädt nicht") },
    otherIssue,
  ],
  exerciseopen: [
    { code: "EXERCISE_INSTRUCTION", category: "EXERCISE", icon: ListChecks, label: t("Помилка в умові", "Task instruction error", "Error en el enunciado", "Fehler in der Aufgabenstellung") },
    { code: "EXERCISE_VALIDATION", category: "EXERCISE", icon: ListChecks, label: t("Неправильна перевірка відповіді", "Incorrect answer validation", "Validación incorrecta", "Falsche Antwortprüfung") },
    { code: "EXERCISE_CORRECT_ANSWER", category: "EXERCISE", icon: ListChecks, label: t("Проблема з правильною відповіддю", "Correct answer problem", "Problema con la respuesta correcta", "Problem mit der richtigen Antwort") },
    { code: "CONTENT_EXPLANATION", category: "CONTENT", icon: FileText, label: t("Помилка в поясненні", "Explanation error", "Error en la explicación", "Fehler in der Erklärung") },
    { code: "TECHNICAL_CONTROL", category: "TECHNICAL", icon: TriangleAlert, label: t("Поле або кнопка не працює", "Field or button does not work", "El campo o el botón no funciona", "Feld oder Schaltfläche funktioniert nicht") },
    otherIssue,
  ],
  general: [
    { code: "CONTENT_GENERAL", category: "CONTENT", icon: FileText, label: t("Помилка у змісті", "Content problem", "Problema de contenido", "Inhaltliches Problem") },
    { code: "VISUAL_GENERAL", category: "VISUAL", icon: ImageIcon, label: t("Проблема із зображенням", "Visual problem", "Problema visual", "Visuelles Problem") },
    { code: "TECHNICAL_GENERAL", category: "TECHNICAL", icon: TriangleAlert, label: t("Технічна проблема", "Technical problem", "Problema técnico", "Technisches Problem") },
    otherIssue,
  ],
};

const CONTENT_TYPE_ALIASES: Record<string, ContentType> = {
  video: "video",
  exercisetest: "exercisetest",
  exercise_test: "exercisetest",
  test: "exercisetest",
  exercisematching: "exercisematching",
  exercise_matching: "exercisematching",
  matching: "exercisematching",
  exerciseopen: "exerciseopen",
  exercise_open: "exerciseopen",
  open: "exerciseopen",
  general: "general",
};

const BASE_URL = import.meta.env.BASE_URL || "./";
const WEBHOOK_URL = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL?.trim();

function readQueryContext(): QueryContext {
  if (typeof window === "undefined") {
    return { lang: "uk", contentId: "", contentType: "general" };
  }

  // Accept the canonical `&` separator and the early integration format with repeated `?`.
  const normalizedSearch = window.location.search.replace(/^\?/, "").replace(/\?/g, "&");
  const params = new URLSearchParams(normalizedSearch);
  const rawLang = (params.get("lan") || params.get("lang") || "uk")
    .toLowerCase()
    .split("-")[0];
  const lang: Lang = (["uk", "en", "es", "de"] as const).includes(rawLang as Lang)
    ? (rawLang as Lang)
    : "uk";
  const rawContentType = (params.get("content_type") || "general").toLowerCase();

  return {
    lang,
    contentId: (params.get("content_id") || "")
      .replace(/[^a-zA-Z0-9._:-]/g, "")
      .slice(0, 120),
    contentType: CONTENT_TYPE_ALIASES[rawContentType] || "general",
  };
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function createFeedbackId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

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

function RiveMascot({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { RiveComponent } = useRive({
    src: `${BASE_URL}dragi.riv`,
    autoplay: false,
    shouldDisableRiveListeners: true,
    isTouchScrollEnabled: true,
    onRiveReady: (rive) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
          <RiveMascot onReady={() => setRiveLoaded(true)} onError={() => setRiveFailed(true)} />
        </div>
      )}
    </div>
  );
}

function SupportFooter({ lang }: { lang: Lang }) {
  const copy = COPY[lang];
  return (
    <footer className="support-footer">
      <span>{copy.urgentSupport}</span>
      <nav aria-label={copy.urgentSupport}>
        <a href="mailto:contact@dragi.app">{copy.supportEmail}</a>
        <span aria-hidden="true">·</span>
        <a href="https://t.me/dragi_support" target="_blank" rel="noreferrer">
          {copy.supportTelegram}
        </a>
      </nav>
    </footer>
  );
}

export default function FeedbackForm() {
  const [context, setContext] = useState<QueryContext>({ lang: "uk", contentId: "", contentType: "general" });
  const [selectedIssueCode, setSelectedIssueCode] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [videoTimestamp, setVideoTimestamp] = useState("");
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
  const contentCopy = CONTENT_COPY[context.contentType];
  const issues = ISSUES_BY_CONTENT_TYPE[context.contentType];
  const issue = useMemo(
    () => issues.find((item) => item.code === selectedIssueCode) || null,
    [issues, selectedIssueCode],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.min(60, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
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
      const preferredTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
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
    setSelectedIssueCode(null);
    setDescription("");
    setVideoTimestamp("");
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
    if (issue.category === "OTHER" && !description.trim() && !audioBlob) {
      setFormError(copy.otherNeedsDetails);
      return;
    }

    setIsSubmitting(true);
    const feedbackId = createFeedbackId();
    const payload = {
      schema_version: 2,
      feedback_id: feedbackId,
      client_created_at: new Date().toISOString(),
      ui_lang: context.lang,
      content_id: context.contentId || null,
      content_type: context.contentType,
      issue_category: issue.category,
      issue_code: issue.code,
      video_timestamp: context.contentType === "video" ? videoTimestamp.trim() || null : null,
      description: description.trim() || null,
      email: email.trim() || null,
      audio: audioBlob
        ? { mime_type: audioBlob.type, size_bytes: audioBlob.size, duration_seconds: recordingSeconds }
        : null,
      platform: "app_webview",
      page_context: { path: window.location.pathname, user_agent: navigator.userAgent },
    };

    try {
      if (WEBHOOK_URL) {
        const data = new FormData();
        data.append("payload", JSON.stringify(payload));
        if (audioBlob) data.append("audio", audioBlob, `${feedbackId}.audio`);
        const response = await fetch(WEBHOOK_URL, { method: "POST", body: data });
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

  const materialLabel = context.contentId
    ? `${contentCopy.label[context.lang]} #${context.contentId}`
    : contentCopy.label[context.lang];

  if (isSubmitted) {
    return (
      <main className="feedback-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="page-stack">
          <section className="success-card" aria-live="polite">
            <div className="success-mark"><Check aria-hidden="true" /></div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.successTitle}</h1>
            <p>{copy.successText}</p>
            <span className="material-pill">{materialLabel}</span>
            {demoSubmission && <p className="demo-note">{copy.demo}</p>}
            <button className="secondary-action" type="button" onClick={resetForm}>
              <RotateCcw size={18} aria-hidden="true" />
              {copy.sendAnother}
            </button>
          </section>
          <SupportFooter lang={context.lang} />
        </div>
      </main>
    );
  }

  return (
    <main className="feedback-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="page-stack">
        <section className="feedback-card">
          <Mascot lang={context.lang} />
          <header className="form-header">
            <div className="header-meta">
              <p className="eyebrow">{copy.eyebrow}</p>
              <span className="material-pill">{materialLabel}</span>
            </div>
            <h1>{contentCopy.title[context.lang]}</h1>
            <p className="intro">{contentCopy.intro[context.lang]}</p>
          </header>

          <form onSubmit={submitFeedback}>
            <fieldset className="category-fieldset">
              <legend>{copy.problemLabel}</legend>
              <div className="category-grid">
                {issues.map((item) => {
                  const Icon = item.icon;
                  const selected = selectedIssueCode === item.code;
                  return (
                    <button
                      className={`category-card ${selected ? "category-card-selected" : ""}`}
                      type="button"
                      key={item.code}
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedIssueCode(item.code);
                        setFormError("");
                      }}
                    >
                      <span className="category-icon"><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></span>
                      <span>{item.label[context.lang]}</span>
                      {selected && <span className="selected-check"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {issue && (
              <div className="details-panel">
                {context.contentType === "video" && (
                  <section className="detail-section">
                    <label className="field-label" htmlFor="video-timestamp">
                      {copy.timestampLabel}<span>{copy.optional}</span>
                    </label>
                    <p className="field-hint">{copy.timestampHint}</p>
                    <input
                      id="video-timestamp"
                      className="text-input"
                      type="text"
                      inputMode="numeric"
                      value={videoTimestamp}
                      maxLength={8}
                      placeholder={copy.timestampPlaceholder}
                      onChange={(event) => setVideoTimestamp(event.target.value)}
                    />
                  </section>
                )}

                <section className="detail-section">
                  <label className="field-label" htmlFor="feedback-description">
                    {copy.descriptionLabel}
                    <span>{issue.category === "OTHER" ? copy.required : copy.optional}</span>
                  </label>
                  <textarea
                    id="feedback-description"
                    value={description}
                    maxLength={1200}
                    rows={4}
                    placeholder={copy.descriptionPlaceholder}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                  <p className="character-count">{description.length}/1200 {copy.characters}</p>
                </section>

                <section className="detail-section audio-section">
                  <div className="section-heading">
                    <div><h2>{copy.voiceTitle}</h2><p>{copy.voiceHint}</p></div>
                    <span>{issue.category === "OTHER" ? copy.required : copy.optional}</span>
                  </div>
                  {!audioUrl ? (
                    <button
                      className={`record-button ${isRecording ? "record-button-active" : ""}`}
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? <Square size={17} fill="currentColor" aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}
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
                    <span className="label-with-icon"><Mail size={17} aria-hidden="true" />{copy.emailLabel}</span>
                    <span>{copy.optional}</span>
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
              <button className="submit-button" type="submit" disabled={!selectedIssueCode || isSubmitting || isRecording}>
                <Send size={19} aria-hidden="true" />
                {isSubmitting ? copy.sending : copy.submit}
              </button>
            </div>
          </form>
        </section>
        <SupportFooter lang={context.lang} />
      </div>
    </main>
  );
}
