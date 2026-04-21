import { EventSourcePolyfill } from 'event-source-polyfill';
const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// ===== helper =====
const getHeaders = () => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  return headers;
};

// ===== GET =====
export const apiGet = async (path) => {
  // console.log(`[GET Request] Fetching: ${API_URL}${path}`); // Log ตอนเริ่มยิง API

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      // console.error(`[GET Error] Status: ${res.status} on path: ${path}`); // Log ตอนเซิร์ฟเวอร์ตอบกลับเป็น Error (เช่น 404, 500)
      throw new Error(`API ${res.status}`);
    }

    const data = await res.json();
    // console.log(`[GET Success] Response from ${path}:`, data); // Log ตอนได้ข้อมูลมาสำเร็จ

    return data;
  } catch (error) {
    // console.error(`[GET Failed] Exception on ${path}:`, error); // Log ตอนพังจากฝั่ง Client (เช่น Network หลุด หรือ Server ไม่ตอบสนอง)
    throw error;
  }
};

// ===== SSE =====
export const createEventSource = (path) => {
  return new EventSourcePolyfill(`${API_URL}${path}`, {
    headers: {
      "x-api-key": API_KEY
    },
    heartbeatTimeout: 60000
  });
};

// ===== Network Check =====
export const checkNetwork = async () => {
  return true;
  // try {
  //   const data = await apiGet("/api/check-network"); 
  //   return data.isInternal; 
  // } catch (error) {
  //   return false;
  // }
};