import React, { useState, useEffect } from "react";
import { SketchPicker } from "react-color";
import { useDropzone } from "react-dropzone";
import styles from "../styles/QRForm.module.css";

const MAX_FILE_MB = 2;

const isLikelyUrl = (value) => {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes(".") || trimmed.startsWith("www.");
};

const QRForm = ({
  values,
  logoFile,
  onChange,
  onLogoChange,
  onGenerate,
  onReset,
  isLoading,
  error,
  uploadProgress,
  autoGenerate,
  onToggleAutoGenerate,
}) => {
  const [localError, setLocalError] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [showFgPicker, setShowFgPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const onDrop = (acceptedFiles, fileRejections) => {
    if (fileRejections && fileRejections.length) {
      setLocalError("Файл слишком большой или имеет неподдерживаемый тип.");
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;

    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setLocalError(`Размер логотипа должен быть ≤ ${MAX_FILE_MB} MB.`);
      return;
    }

    setLocalError("");
    onLogoChange(file);
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    isDragAccept,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
    },
    maxSize: MAX_FILE_MB * 1024 * 1024,
    multiple: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError("");

    const text = values.text || "";
    if (!text.trim()) {
      setLocalError("Текст обязателен.");
      return;
    }

    // Локальная валидация URL (дублирует проверку в App для лучшего UX)
    const lower = text.trim().toLowerCase();
    if (
      isLikelyUrl(text) &&
      !lower.startsWith("http://") &&
      !lower.startsWith("https://")
    ) {
      setLocalError(
        "Если это URL, добавьте http:// или https:// перед адресом."
      );
      return;
    }

    if (values.size < 100 || values.size > 1000) {
      setLocalError("Размер должен быть от 100 до 1000 пикселей.");
      return;
    }

    onGenerate();
  };

  const combinedError = localError || error;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="text">Текст / URL *</label>
          <span className={styles.hint}>Обязательно к заполнению</span>
        </div>
        <textarea
          id="text"
          className={styles.textarea}
          rows={3}
          placeholder="https://example.com или любой текст"
          value={values.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>

      <div className={styles.dualRow}>
        <div className={styles.field}>
          <label htmlFor="size">Размер (px)</label>
          <input
            id="size"
            type="number"
            className={styles.input}
            min={100}
            max={1000}
            value={values.size}
            onChange={(e) =>
              onChange({
                size: Number(e.target.value || 300),
              })
            }
          />
          <span className={styles.hint}>100–1000, по умолчанию 300</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="ecl">Уровень коррекции ошибок</label>
          <select
            id="ecl"
            className={styles.select}
            value={values.errorCorrectionLevel}
            onChange={(e) =>
              onChange({
                errorCorrectionLevel: e.target.value,
              })
            }
          >
            <option value="L">L (низкий ~7%)</option>
            <option value="M">M (средний ~15%)</option>
            <option value="Q">Q (повышенный ~25%)</option>
            <option value="H">H (высокий ~30%)</option>
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="format">Формат</label>
        <select
          id="format"
          className={styles.select}
          value={values.format}
          onChange={(e) =>
            onChange({
              format: e.target.value,
            })
          }
        >
          <option value="png">PNG (поддерживает логотип)</option>
          <option value="svg">SVG (вектор, без логотипа)</option>
        </select>
      </div>

      <div className={styles.dualRow}>
        <div className={styles.field}>
          <label>Цвет QR (передний план)</label>
          <div className={styles.colorRow}>
            <button
              type="button"
              className={styles.colorSwatch}
              onClick={() => setShowFgPicker((prev) => !prev)}
            >
              <span
                className={styles.colorDot}
                style={{ backgroundColor: values.foregroundColor }}
              />
              <span className={styles.colorCode}>{values.foregroundColor}</span>
            </button>
            {showFgPicker && (
              <>
                <div
                  className={styles.popoverCover}
                  onClick={() => setShowFgPicker(false)}
                />
                <div className={styles.popover}>
                  <SketchPicker
                    color={values.foregroundColor}
                    onChange={(color) =>
                      onChange({
                        foregroundColor: color.hex,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label>Цвет фона</label>
          <div className={styles.colorRow}>
            <button
              type="button"
              className={styles.colorSwatch}
              onClick={() => setShowBgPicker((prev) => !prev)}
            >
              <span
                className={styles.colorDot}
                style={{ backgroundColor: values.backgroundColor }}
              />
              <span className={styles.colorCode}>{values.backgroundColor}</span>
            </button>
            {showBgPicker && (
              <>
                <div
                  className={styles.popoverCover}
                  onClick={() => setShowBgPicker(false)}
                />
                <div className={styles.popover}>
                  <SketchPicker
                    color={values.backgroundColor}
                    onChange={(color) =>
                      onChange({
                        backgroundColor: color.hex,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label>Логотип (необязательно)</label>
          <span className={styles.hint}>PNG / JPG / SVG, ≤ 2 MB</span>
        </div>

        <div
          {...getRootProps({
            className: [
              styles.dropzone,
              isDragActive && styles.dropzoneActive,
              isDragReject && styles.dropzoneReject,
              isDragAccept && styles.dropzoneAccept,
            ]
              .filter(Boolean)
              .join(" "),
          })}
        >
          <input {...getInputProps()} />
          <p className={styles.dropzoneTitle}>
            Перетащите логотип сюда или кликните для выбора файла
          </p>
          <p className={styles.dropzoneSubtitle}>
            Логотип будет наложен по центру QR‑кода
          </p>
        </div>

        {logoFile && (
          <div className={styles.logoPreview}>
            {logoPreviewUrl && (
              <img src={logoPreviewUrl} alt="Logo preview" />
            )}
            <div className={styles.logoPreviewMeta}>
              <span className={styles.logoName}>{logoFile.name}</span>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => onLogoChange(null)}
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={values.roundLogo}
            onChange={(e) => onChange({ roundLogo: e.target.checked })}
          />
          <span>Круглый логотип</span>
        </label>
      </div>

      <div className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={autoGenerate}
          onChange={(e) => onToggleAutoGenerate(e.target.checked)}
        />
        <span className={styles.tooltip}>
          Автогенерация при изменении
          <span className={styles.tooltipBadge}>?</span>
          <span className={styles.tooltipContent}>
            При включении QR‑код будет обновляться автоматически с задержкой
            (debounce) при изменениях полей.
          </span>
        </span>
      </div>

      {combinedError && <div className={styles.error}>{combinedError}</div>}

      {uploadProgress > 0 && isLoading && (
        <div className={styles.progress}>
          <div
            className={styles.progressBar}
            style={{ width: `${uploadProgress}%` }}
          />
          <span className={styles.progressLabel}>
            Загрузка логотипа: {uploadProgress}%
          </span>
        </div>
      )}

      <div className={styles.actionsRow}>
        <button type="submit" className={styles.primaryBtn} disabled={isLoading}>
          {isLoading ? "Генерация..." : "Сгенерировать QR"}
        </button>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onReset}
          disabled={isLoading}
        >
          Сбросить настройки
        </button>
      </div>
    </form>
  );
};

export default QRForm;