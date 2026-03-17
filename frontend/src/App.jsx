import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import debounce from "lodash.debounce";
import QRForm from "./components/QRForm";
import QRPreview from "./components/QRPreview";
import HistoryList from "./components/HistoryList";
import { generateQr } from "./services/api";

const DEFAULT_FORM = {
  text: "",
  size: 300,
  foregroundColor: "#000000",
  backgroundColor: "#ffffff",
  errorCorrectionLevel: "M",
  roundLogo: true,
  format: "png",
};

const SETTINGS_KEY = "qr-generator-settings";
const HISTORY_KEY = "qr-generator-history";

const isLikelyUrl = (value) => {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes(".") || trimmed.startsWith("www.");
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
  const [autoGenerate, setAutoGenerate] = useState(true);
  const skipNextAutoGenerateRef = useRef(false);

  // Загрузка настроек и истории из localStorage
  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        const normalizedRoundLogo =
          parsed.roundLogo === true || parsed.roundLogo === "true";
        const normalizedFormat =
          parsed.format === "svg" || parsed.format === "png"
            ? parsed.format
            : "png";
        setForm({
          ...DEFAULT_FORM,
          ...parsed,
          roundLogo: normalizedRoundLogo,
          format: normalizedFormat,
        });
      }
    } catch {
      // ignore
    }

    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
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
      format,
    } = form;
    const payload = {
      text,
      size,
      foregroundColor,
      backgroundColor,
      errorCorrectionLevel,
      roundLogo,
      format,
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [form]);

  // Сохранение истории в localStorage
  const persistHistory = useCallback((items) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, []);

  // Добавление в историю (стабильная функция без пересоздания на каждый рендер)
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

      setError("");
      setIsLoading(true);
      setUploadProgress(0);

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
      formData.append("format", currentForm.format || "png");

      if (currentLogoFile) {
        formData.append("logo", currentLogoFile);
      }

      try {
        const response = await generateQr(formData, (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        });

        const blob = response.data;
        const url = URL.createObjectURL(blob);
        const imagePath = response.headers["x-qr-image-path"];
        const origin = "http://localhost:5000";
        const absoluteUrl = imagePath ? `${origin}${imagePath}` : null;
        const base64Image = await blobToDataUrl(blob);

        // Освобождаем старый Blob URL
        setQrImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setServerUrl(absoluteUrl);

        // Записываем в локальную историю (с превью и параметрами)
        const historyItem = {
          id: Date.now(),
          text: trimmed,
          size: currentForm.size,
          foregroundColor: currentForm.foregroundColor,
          backgroundColor: currentForm.backgroundColor,
          errorCorrectionLevel: currentForm.errorCorrectionLevel,
          hasLogo: !!currentLogoFile,
          createdAt: new Date().toISOString(),
          roundLogo: !!currentForm.roundLogo,
          format: currentForm.format || "png",
          base64Image,
          preview: url,
          serverUrl: absoluteUrl,
        };
        addToHistory(historyItem);
      } catch (e) {
        console.error("QR generation error", e);
        const message =
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
    [addToHistory]
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
    setError("");
  };

  const handleSelectFromHistory = (item) => {
    if (!item) return;
    // ВАЖНО: при выборе из истории мы НЕ должны запускать новую генерацию.
    // Поэтому отменяем debounce и пропускаем следующий авто-триггер от обновления формы.
    debouncedGenerate.cancel();
    skipNextAutoGenerateRef.current = true;

    const nextForm = {
      text: item.text || "",
      size: item.size || 300,
      foregroundColor: item.foregroundColor || "#000000",
      backgroundColor: item.backgroundColor || "#ffffff",
      errorCorrectionLevel: item.errorCorrectionLevel || "M",
      roundLogo: item.roundLogo === true || item.roundLogo === "true",
      format: item.format || "png",
    };
    setForm(nextForm);
    setLogoFile(null);

    if (item.base64Image) {
      setQrImageUrl(item.base64Image);
    } else if (item.serverUrl) {
      setQrImageUrl(item.serverUrl);
    } else if (item.preview) {
      setQrImageUrl(item.preview);
    }

    setServerUrl(item.serverUrl || null);
  };

  const handleDeleteFromHistory = (item) => {
    setHistory((prev) => {
      const next = prev.filter(
        (x) => (x.id || x._id) !== (item.id || item._id)
      );
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