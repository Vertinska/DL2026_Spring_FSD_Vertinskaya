import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// Простой тест эндпоинта
export const testApi = () => api.get("/test");

// Генерация QR: возвращает axios‑ответ с Blob (PNG)
// Обёрнуто в try/catch, чтобы логировать и пробрасывать ошибку наверх
export const generateQr = async (formData, onUploadProgress) => {
  try {
    const response = await api.post("/generate-qr", formData, {
      responseType: "blob",
      onUploadProgress,
    });
    return response;
  } catch (error) {
    console.error("API generateQr error:", error);
    throw error;
  }
};

export default api;