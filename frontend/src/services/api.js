import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : "/api",
});

/**
 * Абсолютный URL к файлу на сервере (для превью, скачивания, «Поделиться»).
 * Без VITE_API_URL в dev используем origin фронта (Vite проксирует /uploads → backend).
 */
export const buildBackendAssetUrl = (assetPath) => {
  if (!assetPath || typeof assetPath !== "string") return null;
  const trimmed = assetPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return null;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (API_URL) return `${API_URL}${path}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

export const testApi = () => api.get("/test");

export const generateQr = async (formData, onUploadProgress, signal) => {
  try {
    const response = await api.post("/generate-qr", formData, {
      responseType: "blob",
      onUploadProgress,
      signal,
    });
    return response;
  } catch (error) {
    if (error?.response?.data instanceof Blob) {
      try {
        const raw = await error.response.data.text();
        const parsed = JSON.parse(raw);
        error.serverMessage =
          parsed?.message || parsed?.error || "Ошибка генерации QR-кода.";
      } catch {
        error.serverMessage = "Ошибка генерации QR-кода.";
      }
    }
    console.error("API generateQr error:", error);
    throw error;
  }
};

export const getHistory = async (limit = 30) =>
  api.get("/history", { params: { limit } });

export const deleteHistoryItem = async (id) => api.delete(`/history/${id}`);

export default api;
