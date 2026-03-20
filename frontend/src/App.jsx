import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash.debounce";
import QRForm from "./components/QRForm";
import QRPreview from "./components/QRPreview";
import HistoryList from "./components/HistoryList";
import {
  buildBackendAssetUrl,
  deleteHistoryItem,
  generateQr,
  getHistory,
} from "./services/api";

const DEFAULT_FORM = {
  text: "",
  size: 300,
  foregroundColor: "#000000",
  backgroundColor: "#ffffff",
  errorCorrectionLevel: "M",
  roundLogo: true,
  logoSize: 50,
  format: "png",
};

const SETTINGS_KEY = "qr-generator-settings";
const HISTORY_KEY = "qr-generator-history";

const isLikelyUrl = (value) => {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes(".") || trimmed.startsWith("www.");
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const normalized = hex.trim().toUpperCase();
  const short = /^#([0-9A-F]{3})$/.exec(normalized);
  const full = /^#([0-9A-F]{6})$/.exec(normalized);

  let r;
  let g;
  let b;
  if (short) {
    r = parseInt(short[1][0] + short[1][0], 16);
    g = parseInt(short[1][1] + short[1][1], 16);
    b = parseInt(short[1][2] + short[1][2], 16);
  } else if (full) {
    r = parseInt(full[1].slice(0, 2), 16);
    g = parseInt(full[1].slice(2, 4), 16);
    b = parseInt(full[1].slice(4, 6), 16);
  } else {
    return null;
  }

  return { r, g, b };
};

const relativeLuminance = ({ r, g, b }) => {
  const srgb = [r, g, b].map((v) => v / 255);
  const linear = srgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (fgHex, bgHex) => {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
};

const areColorsReadable = (fgHex, bgHex) => {
  if (!fgHex || !bgHex) return true;
  if (fgHex.trim().toUpperCase() === bgHex.trim().toUpperCase()) return false;

  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio === null) return true;
  return ratio >= 2.5;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const App = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [isServerHistoryEnabled, setIsServerHistoryEnabled] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [, setCurrentImageBlob] = useState(null);
  const skipNextAutoGenerateRef = useRef(false);
  const lastSignatureRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Загрузка настроек и fallback-истории из localStorage
  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        const normalizedRoundLogo =
          parsed.roundLogo === true || parsed.roundLogo === "true";
        const normalizedLogoSize =
          Number.isFinite(Number(parsed.logoSize)) && Number(parsed.logoSize) >= 30
            ? Math.max(30, Math.min(80, Number(parsed.logoSize)))
            : DEFAULT_FORM.logoSize;
        const normalizedFormat =
          parsed.format === "svg" || parsed.format === "png"
            ? parsed.format
            : "png";
        setForm({
          ...DEFAULT_FORM,
          ...parsed,
          roundLogo: normalizedRoundLogo,
          logoSize: normalizedLogoSize,
          format: normalizedFormat,
        });
      }
    } catch {
      // ignore
    }

    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (!rawHistory) return;
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Сохранение настроек формы в localStorage
  useEffect(() => {
    const {
      text,
      size,
      foregroundColor,
      backgroundColor,
      errorCorrectionLevel,
      roundLogo,
      logoSize,
      format,
    } = form;
    const payload = {
      text,
      size,
      foregroundColor,
      backgroundColor,
      errorCorrectionLevel,
      roundLogo,
      logoSize,
      format,
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [form]);

  // Сохранение fallback-истории в localStorage
  const persistHistory = useCallback((items) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, []);

  const normalizeHistoryItem = useCallback((item) => {
    if (!item) return null;
    const imagePathOrUrl = item.imageUrl || item.imagePath || null;
    return {
      ...item,
      id: item.id || item._id,
      imageUrl: buildBackendAssetUrl(imagePathOrUrl),
    };
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await getHistory(30);
      const items = Array.isArray(response.data)
        ? response.data.map(normalizeHistoryItem).filter(Boolean)
        : [];
      setHistory(items);
      setIsServerHistoryEnabled(true);
    } catch (e) {
      console.warn("Server history is unavailable, fallback to localStorage", e);
      setIsServerHistoryEnabled(false);
    }
  }, [normalizeHistoryItem]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Добавление в fallback-историю localStorage
  const addToHistory = useCallback(
    (entry) => {
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        persistHistory(next);
        return next;
      });
    },
    [persistHistory]
  );
  const doGenerate = useCallback(
    async (currentForm, currentLogoFile) => {
      if (!currentForm.text.trim()) {
        setError("");
        return;
      }

      // Валидация URL (чтобы был http/https, если это похоже на ссылку)
      const trimmed = currentForm.text.trim();
      const lower = trimmed.toLowerCase();
      if (
        isLikelyUrl(trimmed) &&
        !lower.startsWith("http://") &&
        !lower.startsWith("https://")
      ) {
        setError("Если это URL, он должен начинаться с http:// или https://");
        return;
      }

      const signature = JSON.stringify({
        text: trimmed,
        size: currentForm.size,
        foregroundColor: currentForm.foregroundColor,
        backgroundColor: currentForm.backgroundColor,
        errorCorrectionLevel: currentForm.errorCorrectionLevel,
        roundLogo: !!currentForm.roundLogo,
        logoSize: currentForm.logoSize || 50,
        format: currentForm.format || "png",
        logo: currentLogoFile
          ? `${currentLogoFile.name}:${currentLogoFile.size}:${
              currentLogoFile.lastModified || 0
            }`
          : null,
      });

      // Guard: если параметры не менялись — не генерируем повторно.
      if (lastSignatureRef.current === signature) {
        return;
      }

      // Abort previous in-flight request (prevents loops/races).
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setError("");
      setIsLoading(true);
      setUploadProgress(0);

      // Protect against unreadable QR (too similar colors)
      if (
        !areColorsReadable(currentForm.foregroundColor, currentForm.backgroundColor)
      ) {
        setIsLoading(false);
        setError(
          "Цвета переднего плана и фона слишком похожи. Выберите более контрастные цвета."
        );
        return;
      }

      const formData = new FormData();
      formData.append("text", trimmed);
      if (currentForm.size) formData.append("size", String(currentForm.size));
      if (currentForm.foregroundColor)
        formData.append("foregroundColor", currentForm.foregroundColor);
      if (currentForm.backgroundColor)
        formData.append("backgroundColor", currentForm.backgroundColor);
      if (currentForm.errorCorrectionLevel)
        formData.append(
          "errorCorrectionLevel",
          currentForm.errorCorrectionLevel
        );
      formData.append("roundLogo", String(!!currentForm.roundLogo));
      formData.append("logoSize", String(currentForm.logoSize || 50));
      formData.append("format", currentForm.format || "png");

      if (currentLogoFile) {
        formData.append("logo", currentLogoFile);
      }

      try {
        const response = await generateQr(
          formData,
          (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
          },
          abortControllerRef.current.signal
        );

        const blob = response.data;
        const url = URL.createObjectURL(blob);
        const imagePath =
          response.headers["x-qr-image-path"] ||
          response.headers["X-QR-Image-Path"];
        const absoluteUrl = buildBackendAssetUrl(imagePath);
        const base64Image = await blobToDataUrl(blob);

        // Освобождаем старый Blob URL
        setQrImageUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });
        setCurrentImageBlob(blob);
        setServerUrl(absoluteUrl);
        lastSignatureRef.current = signature;

        if (isServerHistoryEnabled) {
          await loadHistory();
          return;
        }

        // Если серверная история недоступна, сохраняем локальный fallback.
        const historyItem = normalizeHistoryItem({
          id: Date.now(),
          text: trimmed,
          size: currentForm.size,
          foregroundColor: currentForm.foregroundColor,
          backgroundColor: currentForm.backgroundColor,
          errorCorrectionLevel: currentForm.errorCorrectionLevel,
          hasLogo: !!currentLogoFile,
          createdAt: new Date().toISOString(),
          roundLogo: !!currentForm.roundLogo,
          logoSize: currentForm.logoSize || 50,
          format: currentForm.format || "png",
          base64Image,
          imageUrl: absoluteUrl,
        });
        addToHistory(historyItem);
      } catch (e) {
        // Ignore abort errors, they are expected when user changes inputs quickly.
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") {
          return;
        }
        lastSignatureRef.current = null;
        console.error("QR generation error", e);
        const message =
          e.serverMessage ||
          e.response?.data?.message ||
          e.response?.data?.error ||
          e.message ||
          "Не удалось сгенерировать QR‑код.";
        setError(message);
      } finally {
        setIsLoading(false);
        setUploadProgress(0);
      }
    },
    [addToHistory, isServerHistoryEnabled, loadHistory, normalizeHistoryItem]
  );

  const debouncedGenerate = useMemo(
    () =>
      debounce((nextForm, nextLogo) => {
        doGenerate(nextForm, nextLogo);
      }, 600),
    [doGenerate]
  );

  // Автогенерация с debounce при изменении формы
  useEffect(() => {
    if (!autoGenerate) return;
    if (!form.text.trim()) return;
    if (skipNextAutoGenerateRef.current) {
      skipNextAutoGenerateRef.current = false;
      return;
    }
    debouncedGenerate(form, logoFile);
  }, [autoGenerate, debouncedGenerate, form, logoFile]);

  const handleFormChange = (patch) => {
    setForm((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const handleLogoChange = (file) => {
    setLogoFile(file);
  };

  const handleManualGenerate = () => {
    debouncedGenerate.cancel();
    doGenerate(form, logoFile);
  };

  const handleReset = () => {
    debouncedGenerate.cancel();
    setForm(DEFAULT_FORM);
    setLogoFile(null);
    setQrImageUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setCurrentImageBlob(null);
    setServerUrl(null);
    lastSignatureRef.current = null;
    setError("");
  };

  const handleSelectFromHistory = (item) => {
    if (!item) return;
    // ВАЖНО: при выборе из истории мы НЕ должны запускать новую генерацию.
    // Поэтому отменяем debounce и пропускаем следующий авто-триггер от обновления формы.
    debouncedGenerate.cancel();
    skipNextAutoGenerateRef.current = true;
    lastSignatureRef.current = null;

    const nextForm = {
      text: item.text || "",
      size: item.size || 300,
      foregroundColor: item.foregroundColor || "#000000",
      backgroundColor: item.backgroundColor || "#ffffff",
      errorCorrectionLevel: item.errorCorrectionLevel || "M",
      roundLogo:
        item.roundLogo === undefined || item.roundLogo === null
          ? DEFAULT_FORM.roundLogo
          : item.roundLogo === true || item.roundLogo === "true",
      logoSize: item.logoSize || DEFAULT_FORM.logoSize,
      format: item.format || "png",
    };
    setForm(nextForm);
    setLogoFile(null);

    const imageUrl =
      item.base64Image ||
      item.imageUrl ||
      buildBackendAssetUrl(item.imagePath || item.serverUrl) ||
      null;
    setQrImageUrl(imageUrl);
    setCurrentImageBlob(null);
    setServerUrl(item.imageUrl || buildBackendAssetUrl(item.imagePath) || null);
  };

  const handleDeleteFromHistory = async (item) => {
    const id = item.id || item._id;
    if (!id) return;

    if (isServerHistoryEnabled) {
      try {
        await deleteHistoryItem(id);
        await loadHistory();
        return;
      } catch (e) {
        console.warn("Failed to delete from server history, fallback to local", e);
        setIsServerHistoryEnabled(false);
      }
    }

    setHistory((prev) => {
      const next = prev.filter((x) => (x.id || x._id) !== id);
      persistHistory(next);
      return next;
    });
  };

  return (
    <div className="app-shell">
      <div className="app-card">
        <section className="left-pane">
          <header className="app-header">
            <h1 className="app-title">QR Generator with Logo</h1>
            <p className="app-subtitle">
              Гибкая генерация QR‑кодов с цветами, размером и логотипом.
            </p>
          </header>

          <QRForm
            values={form}
            logoFile={logoFile}
            onChange={handleFormChange}
            onLogoChange={handleLogoChange}
            onGenerate={handleManualGenerate}
            onReset={handleReset}
            isLoading={isLoading}
            error={error}
            uploadProgress={uploadProgress}
            autoGenerate={autoGenerate}
            onToggleAutoGenerate={setAutoGenerate}
          />
        </section>

        <section className="right-pane">
          <QRPreview
            imageUrl={qrImageUrl}
            serverUrl={serverUrl}
            format={form.format}
            isLoading={isLoading}
            error={error}
          />
          <HistoryList
            items={history}
            onSelect={handleSelectFromHistory}
            onDelete={handleDeleteFromHistory}
          />
        </section>
      </div>
    </div>
  );
};

export default App;