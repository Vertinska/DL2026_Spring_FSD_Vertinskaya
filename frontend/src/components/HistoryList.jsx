import React from "react";
import styles from "../styles/HistoryList.module.css";

const BACKEND_ORIGIN = "http://localhost:5000";

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const HistoryList = ({ items, onSelect, onDelete }) => {
  if (!items || items.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          История появится здесь после генерации первых QR‑кодов.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <h3 className={styles.title}>История</h3>
      <ul className={styles.ul}>
        {items.map((item) => {
          const key = item._id || item.id;
          const imageSrc =
            item.preview ||
            (item.imagePath ? `${BACKEND_ORIGIN}${item.imagePath}` : null);

          const shortText =
            item.text && item.text.length > 60
              ? `${item.text.slice(0, 60)}…`
              : item.text || "Текст не указан";

          return (
            <li
              key={key}
              className={styles.item}
              onClick={() => onSelect && onSelect(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelect && onSelect(item);
                }
              }}
            >
              <div className={styles.thumbWrapper}>
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt="QR миниатюра"
                    className={styles.thumb}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className={styles.thumbPlaceholder}>QR</div>
                )}
              </div>

              <div className={styles.itemMain}>
                <div className={styles.text} title={item.text}>
                  {shortText}
                </div>
                <div className={styles.meta}>
                  <span>{item.size || 300}px</span>
                  <span>{item.errorCorrectionLevel || "M"}</span>
                  {(item.hasLogo || item.logoPath) && <span>• логотип</span>}
                  {item.createdAt && (
                    <span className={styles.date}>
                      {formatDateTime(item.createdAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.loadButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect && onSelect(item);
                  }}
                >
                  Использовать
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete && onDelete(item);
                  }}
                >
                  Удалить
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default HistoryList;