const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const TOKEN_KEY = "ras_token";

// Shared helper for backend calls. Attaches the saved token to the Authorization header automatically.
// `body` can be a plain object (sent as JSON) or a FormData (sent as multipart, used for photo uploads).
export async function apiFetch(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = body instanceof FormData;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        // For FormData the browser sets Content-Type itself (it must include the multipart boundary)
        ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    // The server is down (including a sleeping free-tier host) or the network is offline
    throw new Error("Can't reach the server. If it was idle, wait a minute and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}
