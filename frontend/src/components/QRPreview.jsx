import React, { useEffect, useState } from "react";
import styles from "../styles/QRPreview.module.css";

const isEphemeralUrl = (u) =>
  !u ||
  typeof u !== "string" ||
  u.startsWith("blob:") ||
  u.startsWith("data:");

/** Ссылка, которую можно открыть в другой вкладке / вставить в адресную строку */
const getShareableLink = (serverUrl, imageUrl) => {
  if (!isEphemeralUrl(serverUrl)) return serverUrl;
  if (!isEphemeralUrl(imageUrl)) return imageUrl;
  return null;
};

const QRPreview = ({ imageUrl, serverUrl, format = "png", isLoading, error }) => {
  const hasImage = Boolean(imageUrl);
  const downloadName = format === "svg" ? "qr-code.svg" : "qr-code.png";
  const hrefForDownload = serverUrl || imageUrl;
  const shareableLink = getShareableLink(serverUrl, imageUrl);
  const [info, setInfo] = useState("");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(""), 2000);
    return () => clearTimeout(t);
  }, [info]);

  // Если URL картинки изменился (новая генерация или "Использовать" из истории) —
  // сбрасываем ошибку загрузки изображения.
  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const copyText = async (text) => {
    // clipboard API работает на localhost, но иногда падает без прав.
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback через execCommand
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const handleCopyLink = async () => {
    const link = shareableLink;
    if (!link) {
      setInfo(
        "Постоянная ссылка недоступна (нет URL на сервере). Сгенерируйте QR ещё раз."
      );
      return;
    }
    const ok = await copyText(link);
    setInfo(ok ? "Ссылка скопирована" : "Не удалось скопировать ссылку");
  };

  const handleDownload = async () => {
    if (!hrefForDownload) return;

    // Важно: атрибут download для cross-origin часто игнорируется,
    // поэтому скачиваем программно через Blob.
    try {
      let blob;
      if (serverUrl) {
        const resp = await fetch(serverUrl, { mode: "cors" });
        if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
        blob = await resp.blob();
      } else {
        const resp = await fetch(imageUrl);
        blob = await resp.blob();
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setInfo(`Скачивание ${format.toUpperCase()} началось`);
    } catch (e) {
      console.error("Download error:", e);
      setInfo("Не удалось скачать файл");
    }
  };

  return (
    <div className={styles.previewCard}>
      <div className={styles.header}>
        <h2 className={styles.title}>Предпросмотр</h2>
        <span className={styles.caption}>
          Сгенерированный QR‑код появится в этой области.
        </span>
      </div>

      <div className={styles.canvas}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loader} />
            <span>Генерация QR‑кода...</span>
          </div>
        )}

        {hasImage && !imgError ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt="Сгенерированный QR-код"
            className={styles.image}
            onError={(e) => {
              console.warn("QR preview image failed to load:", e);
              setImgError(true);
            }}
          />
        ) : (
          <div className={styles.placeholder}>
            <span>Пока нет QR‑кода</span>
            <p>
              {imgError
                ? "Не удалось загрузить изображение предпросмотра. Попробуйте сгенерировать ещё раз."
                : "Заполните форму слева и нажмите «Сгенерировать QR»."}
            </p>
          </div>
        )}
      </div>

      {hasImage && (
        <div className={styles.actionsRow} style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={handleDownload}
            className={styles.downloadLink}
          >
            Скачать {format.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className={styles.downloadLink}
            disabled={!shareableLink}
            title={
              shareableLink
                ? "Копировать ссылку на файл на сервере"
                : "Сначала нужна ссылка на сервер (не blob)"
            }
          >
            Поделиться (копировать ссылку)
          </button>
        </div>
      )}

      {info && <div className={styles.caption}>{info}</div>}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default QRPreview;