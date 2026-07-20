/**
 * App localization — a plain typed dictionary (no i18n library), adapted from
 * the sibling farma-kit project's `I18N` map to Preact: instead of walking the
 * DOM, a context exposes the current language's message object so components
 * read `m.someKey` (type-safe) or call `m.someFn(arg)` for interpolation.
 *
 * Two languages for now (English + Spanish); the chosen language persists in
 * localStorage and defaults from the browser. Add a language by adding one
 * entry to `MESSAGES` (TypeScript then forces every key to be translated).
 */
import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useMemo, useState } from "preact/hooks";

export type Lang = "en" | "es";

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

/** Every user-facing string in the app. Functions are for interpolation. */
export interface Messages {
  // ---- shell / App ----
  tagline: string;
  privateBadge: string;
  toggleTheme: string;
  switchToLight: string;
  switchToDark: string;
  viewSource: string;
  language: string;
  wizardSteps: string;
  stepUpload: string;
  stepEdit: string;
  stepTrace: string;
  stepExport: string;
  continueToEdit: string;
  continueToTrace: string;
  continueToExport: string;
  startOver: string;
  back: string;
  nowOnStep: (step: string) => string;
  // ---- Upload ----
  addImage: string;
  uploadSubtext: string;
  dropHerePrefix: string;
  browse: string;
  formats: string;
  yourImage: string;
  fileName: string;
  dimensions: string;
  replaceImage: string;
  removeImage: string;
  chooseFile: string;
  uploadedPreview: string;
  decoding: (name: string) => string;
  decodeGenericError: string;
  // ---- Editor ----
  straightenCrop: string;
  undo: string;
  redo: string;
  reset: string;
  undoTitle: string;
  redoTitle: string;
  resetToOriginal: string;
  rotate: string;
  rotateLeft: string;
  rotateRight: string;
  rotateLeftTitle: string;
  rotateRightTitle: string;
  straightenHint: string;
  crop: string;
  cropHint: string;
  rotateHandleLabel: string;
  rotateHandleTitle: string;
  cropHandleLabel: (part: string) => string;
  handleTopLeft: string;
  handleTopRight: string;
  handleBottomLeft: string;
  handleBottomRight: string;
  handleTop: string;
  handleRight: string;
  handleBottom: string;
  handleLeft: string;
  // ---- zoom (shared Editor + Preview) ----
  zoomOut: string;
  zoomIn: string;
  fit: string;
  fitTitle: string;
  // ---- TweakPanel ----
  colors: string;
  colorsHint: string;
  blackWhite: string;
  colorsCount: (n: number) => string;
  auto: string;
  autoColorsCount: (n: number) => string;
  numberOfColors: string;
  smoothness: string;
  detail: string;
  contrast: string;
  smoothnessHint: string;
  detailHint: string;
  contrastHint: string;
  traceAdjustments: string;
  resetControl: (label: string) => string;
  background: string;
  backgroundHandling: string;
  transparent: string;
  solid: string;
  // ---- Preview ----
  traceTweak: string;
  svgReady: string;
  holdToSeeOriginal: string;
  holdToSeeOriginalTitle: string;
  originalImage: string;
  tracedPreview: string;
  retracing: string;
  // ---- Trace ----
  tracing: string;
  tryAgain: string;
  tracerFailedStart: string;
  tracerBadResponse: string;
  tracePrepareError: string;
  noImageToTrace: string;
  // ---- Export ----
  noTracedImage: string;
  estimatedSize: string;
  pathCount: string;
  outputSize: string;
  width: string;
  height: string;
  sizeUnit: string;
  keepAspectRatio: string;
  ratioLocked: string;
  ratioUnlocked: string;
  downloadSvg: string;
  svgMarkup: string;
  copy: string;
  copied: string;
  copyFailed: string;
  copySvgMarkup: string;
  downloadFileName: string;
  sizeErrorBoth: string;
  sizeErrorWidth: string;
  sizeErrorHeight: string;
}

const en: Messages = {
  tagline: "Free, easy & private image vectorizer",
  privateBadge: "Private — files never leave your device",
  toggleTheme: "Toggle theme",
  switchToLight: "Switch to light theme",
  switchToDark: "Switch to dark theme",
  viewSource: "View source on GitHub",
  language: "Language",
  wizardSteps: "Wizard steps",
  stepUpload: "Upload",
  stepEdit: "Edit",
  stepTrace: "Trace",
  stepExport: "Export",
  continueToEdit: "Continue to Edit",
  continueToTrace: "Continue to Trace",
  continueToExport: "Continue to Export",
  startOver: "Start over",
  back: "Back",
  nowOnStep: (step) => `Now on step: ${step}`,
  addImage: "Add an image to vectorize",
  uploadSubtext: "It’s traced right here in your browser — nothing is uploaded anywhere.",
  dropHerePrefix: "Drop an image here, or ",
  browse: "browse",
  formats: "PNG · JPEG · WebP · GIF · BMP · AVIF · up to 25 MB",
  yourImage: "Your image",
  fileName: "File name",
  dimensions: "Dimensions",
  replaceImage: "Replace image",
  removeImage: "Remove image",
  chooseFile: "Choose file",
  uploadedPreview: "Uploaded image preview",
  decoding: (name) => `Decoding ${name}…`,
  decodeGenericError: "Something went wrong reading that file. Please try again.",
  straightenCrop: "Straighten & crop",
  undo: "Undo",
  redo: "Redo",
  reset: "Reset",
  undoTitle: "Undo (Ctrl/Cmd+Z)",
  redoTitle: "Redo (Ctrl/Cmd+Shift+Z)",
  resetToOriginal: "Reset to original",
  rotate: "Rotate",
  rotateLeft: "90° left",
  rotateRight: "90° right",
  rotateLeftTitle: "Rotate left 90° (Shift+R)",
  rotateRightTitle: "Rotate right 90° (R)",
  straightenHint: "Drag the handle above the image to straighten.",
  crop: "Crop",
  cropHint: "Drag the corners or edges on the image.",
  rotateHandleLabel: "Rotate image (arrow keys, Shift = 45°, Ctrl/Cmd = fine)",
  rotateHandleTitle: "Drag or arrow keys to rotate · Shift = snap 45° · Ctrl/Cmd = fine",
  cropHandleLabel: (part) => `Crop ${part}`,
  handleTopLeft: "top-left corner",
  handleTopRight: "top-right corner",
  handleBottomLeft: "bottom-left corner",
  handleBottomRight: "bottom-right corner",
  handleTop: "top edge",
  handleRight: "right edge",
  handleBottom: "bottom edge",
  handleLeft: "left edge",
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  fit: "Fit",
  fitTitle: "Fit the image to the frame",
  colors: "Colors",
  colorsHint: "How many colors to keep.",
  blackWhite: "Black & white",
  colorsCount: (n) => `${n} colors`,
  auto: "Auto",
  autoColorsCount: (n) => `${n} color${n === 1 ? "" : "s"}`,
  numberOfColors: "Number of colors",
  smoothness: "Smoothness",
  detail: "Detail",
  contrast: "Contrast",
  smoothnessHint: "Rounds off jagged edges.",
  detailHint: "Keeps small features and fine lines.",
  contrastHint: "Splits colors into more or fewer layers.",
  traceAdjustments: "Trace adjustments",
  resetControl: (label) => `Reset ${label}`,
  background: "Background",
  backgroundHandling: "Background handling",
  transparent: "Transparent",
  solid: "Solid",
  traceTweak: "Trace & Tweak",
  svgReady: "Your SVG is ready",
  holdToSeeOriginal: "Hold to see original",
  holdToSeeOriginalTitle: "Press and hold (or Space/Enter) to reveal the original image",
  originalImage: "Original image",
  tracedPreview: "Traced SVG preview",
  retracing: "Retracing",
  tracing: "Tracing…",
  tryAgain: "Try again",
  tracerFailedStart: "The tracer failed to start. Please try again.",
  tracerBadResponse: "The tracer sent a response that couldn’t be read. Please try again.",
  tracePrepareError: "Couldn’t prepare the image for tracing. Please try again.",
  noImageToTrace: "No image to trace yet — go back and choose one first.",
  noTracedImage: "No traced image yet — go back and trace one first.",
  estimatedSize: "Estimated size",
  pathCount: "Path count",
  outputSize: "Output size",
  width: "Width",
  height: "Height",
  sizeUnit: "Size unit",
  keepAspectRatio: "Keep aspect ratio",
  ratioLocked: "Aspect ratio locked",
  ratioUnlocked: "Aspect ratio unlocked",
  downloadSvg: "Download .svg",
  svgMarkup: "SVG markup",
  copy: "Copy",
  copied: "Copied!",
  copyFailed: "Failed",
  copySvgMarkup: "Copy SVG markup",
  downloadFileName: "Download file name",
  sizeErrorBoth: "Width and height must be positive numbers — using the last valid size instead.",
  sizeErrorWidth: "Width must be a positive number — using the last valid size instead.",
  sizeErrorHeight: "Height must be a positive number — using the last valid size instead.",
};

const es: Messages = {
  tagline: "Vectorizador de imágenes libre, fácil y privado",
  privateBadge: "Privado — los archivos nunca salen de tu dispositivo",
  toggleTheme: "Cambiar tema",
  switchToLight: "Cambiar al tema claro",
  switchToDark: "Cambiar al tema oscuro",
  viewSource: "Ver el código en GitHub",
  language: "Idioma",
  wizardSteps: "Pasos del asistente",
  stepUpload: "Subir",
  stepEdit: "Editar",
  stepTrace: "Vectorizar",
  stepExport: "Exportar",
  continueToEdit: "Continuar a Editar",
  continueToTrace: "Continuar a Vectorizar",
  continueToExport: "Continuar a Exportar",
  startOver: "Empezar de nuevo",
  back: "Atrás",
  nowOnStep: (step) => `Ahora en el paso: ${step}`,
  addImage: "Añade una imagen para vectorizar",
  uploadSubtext: "Se vectoriza aquí mismo, en tu navegador — no se sube nada a ningún sitio.",
  dropHerePrefix: "Arrastra una imagen aquí, o ",
  browse: "explora",
  formats: "PNG · JPEG · WebP · GIF · BMP · AVIF · hasta 25 MB",
  yourImage: "Tu imagen",
  fileName: "Nombre del archivo",
  dimensions: "Dimensiones",
  replaceImage: "Reemplazar imagen",
  removeImage: "Quitar imagen",
  chooseFile: "Elegir archivo",
  uploadedPreview: "Vista previa de la imagen subida",
  decoding: (name) => `Descodificando ${name}…`,
  decodeGenericError: "Algo salió mal al leer ese archivo. Inténtalo de nuevo.",
  straightenCrop: "Enderezar y recortar",
  undo: "Deshacer",
  redo: "Rehacer",
  reset: "Restablecer",
  undoTitle: "Deshacer (Ctrl/Cmd+Z)",
  redoTitle: "Rehacer (Ctrl/Cmd+Mayús+Z)",
  resetToOriginal: "Restablecer al original",
  rotate: "Rotar",
  rotateLeft: "90° izq.",
  rotateRight: "90° der.",
  rotateLeftTitle: "Rotar 90° a la izquierda (Mayús+R)",
  rotateRightTitle: "Rotar 90° a la derecha (R)",
  straightenHint: "Arrastra el tirador sobre la imagen para enderezar.",
  crop: "Recortar",
  cropHint: "Arrastra las esquinas o los bordes en la imagen.",
  rotateHandleLabel: "Rotar la imagen (flechas, Mayús = 45°, Ctrl/Cmd = fino)",
  rotateHandleTitle: "Arrastra o usa las flechas para rotar · Mayús = 45° · Ctrl/Cmd = fino",
  cropHandleLabel: (part) => `Recortar ${part}`,
  handleTopLeft: "esquina superior izquierda",
  handleTopRight: "esquina superior derecha",
  handleBottomLeft: "esquina inferior izquierda",
  handleBottomRight: "esquina inferior derecha",
  handleTop: "borde superior",
  handleRight: "borde derecho",
  handleBottom: "borde inferior",
  handleLeft: "borde izquierdo",
  zoomOut: "Alejar",
  zoomIn: "Acercar",
  fit: "Ajustar",
  fitTitle: "Ajustar la imagen al marco",
  colors: "Colores",
  colorsHint: "Cuántos colores conservar.",
  blackWhite: "Blanco y negro",
  colorsCount: (n) => `${n} colores`,
  auto: "Auto",
  autoColorsCount: (n) => `${n} color${n === 1 ? "" : "es"}`,
  numberOfColors: "Número de colores",
  smoothness: "Suavizado",
  detail: "Detalle",
  contrast: "Contraste",
  smoothnessHint: "Redondea los bordes irregulares.",
  detailHint: "Conserva los detalles pequeños y las líneas finas.",
  contrastHint: "Divide los colores en más o menos capas.",
  traceAdjustments: "Ajustes de vectorizado",
  resetControl: (label) => `Restablecer ${label}`,
  background: "Fondo",
  backgroundHandling: "Gestión del fondo",
  transparent: "Transparente",
  solid: "Sólido",
  traceTweak: "Vectorizar y ajustar",
  svgReady: "Tu SVG está listo",
  holdToSeeOriginal: "Mantén pulsado para ver el original",
  holdToSeeOriginalTitle: "Mantén pulsado (o Espacio/Intro) para ver la imagen original",
  originalImage: "Imagen original",
  tracedPreview: "Vista previa del SVG vectorizado",
  retracing: "Revectorizando",
  tracing: "Vectorizando…",
  tryAgain: "Reintentar",
  tracerFailedStart: "El vectorizador no pudo arrancar. Inténtalo de nuevo.",
  tracerBadResponse: "El vectorizador envió una respuesta ilegible. Inténtalo de nuevo.",
  tracePrepareError: "No se pudo preparar la imagen para vectorizar. Inténtalo de nuevo.",
  noImageToTrace: "Aún no hay imagen para vectorizar — vuelve y elige una.",
  noTracedImage: "Aún no hay imagen vectorizada — vuelve y vectoriza una.",
  estimatedSize: "Tamaño estimado",
  pathCount: "Número de trazados",
  outputSize: "Tamaño de salida",
  width: "Ancho",
  height: "Alto",
  sizeUnit: "Unidad de tamaño",
  keepAspectRatio: "Mantener la proporción",
  ratioLocked: "Proporción bloqueada",
  ratioUnlocked: "Proporción desbloqueada",
  downloadSvg: "Descargar .svg",
  svgMarkup: "Código SVG",
  copy: "Copiar",
  copied: "¡Copiado!",
  copyFailed: "Error",
  copySvgMarkup: "Copiar el código SVG",
  downloadFileName: "Nombre del archivo de descarga",
  sizeErrorBoth: "El ancho y el alto deben ser números positivos — se usa el último tamaño válido.",
  sizeErrorWidth: "El ancho debe ser un número positivo — se usa el último tamaño válido.",
  sizeErrorHeight: "El alto debe ser un número positivo — se usa el último tamaño válido.",
};

export const MESSAGES: Record<Lang, Messages> = { en, es };

const STORAGE_KEY = "halftone.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    // localStorage can throw in private-mode/sandboxed contexts — fall through.
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase()?.startsWith("es")
    ? "es"
    : "en";
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The current language's message object — read `m.key` or call `m.fn(arg)`. */
  m: Messages;
}

// Default to English so components used outside a provider (e.g. in unit tests)
// still render — the real <I18nProvider> overrides this for the running app.
const I18nContext = createContext<I18n>({ lang: "en", setLang: () => {}, m: en });

export function I18nProvider({ children }: { children: ComponentChildren }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence; ignore storage failures.
    }
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18n>(() => ({ lang, setLang, m: MESSAGES[lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
