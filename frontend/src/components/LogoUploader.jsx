import React, { useState, useCallback } from "react";
import styles from "../styles/LogoUploader.module.css";

const LogoUploader = ({ file, onFileSelected, maxSizeMb = 2, accept }) => {
  const [error, setError] = useState("");

  const validateFile = useCallback(
    (f) => {
      if (!f) return false;

      if (accept && !f.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        return false;
      }

      const maxBytes = maxSizeMb * 1024 * 1024;
      if (f.size > maxBytes) {
        setError(`File size must be ≤ ${maxSizeMb} MB.`);
        return false;
      }

      setError("");
      return true;
    },
    [accept, maxSizeMb]
  );

  const handleFile = (f) => {
    if (!f) return;
    if (!validateFile(f)) return;
    onFileSelected(f);
  };

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    handleFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const clearFile = () => {
    onFileSelected(null);
    setError("");
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>Logo (optional)</label>
      <div
        className={styles.dropZone}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={styles.dropZoneInner}>
          <p className={styles.dropTitle}>
            Drag & drop logo image here
          </p>
          <p className={styles.dropSubtitle}>or click to browse</p>
          <input
            type="file"
            className={styles.fileInput}
            accept={accept}
            onChange={handleInputChange}
          />
        </div>
      </div>
      {file && (
        <div className={styles.fileInfo}>
          <span className={styles.fileName}>{file.name}</span>
          <button
            type="button"
            className={styles.clearButton}
            onClick={clearFile}
          >
            Remove
          </button>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default LogoUploader;

