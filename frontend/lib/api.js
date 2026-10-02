const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const TOKEN_KEY = "ras_token";

// backend API call common function. If a token is saved, it is automatically attached to the Authorization header.
export async function apiFetch(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // if no network connection, fetch will throw an error. we catch it and throw a more user-friendly error message.
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
