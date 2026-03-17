import React from "react";
import { SketchPicker } from "react-color";
import styles from "../styles/ColorPicker.module.css";

const ColorPicker = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>{label}</label>
      <button
        type="button"
        className={styles.swatch}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span
          className={styles.colorPreview}
          style={{ backgroundColor: value }}
        />
        <span className={styles.colorCode}>{value}</span>
      </button>
      {isOpen && (
        <div className={styles.popover}>
          <div
            className={styles.cover}
            onClick={() => setIsOpen(false)}
          />
          <SketchPicker
            color={value}
            onChange={(color) => onChange(color.hex)}
          />
        </div>
      )}
    </div>
  );
};

export default ColorPicker;

