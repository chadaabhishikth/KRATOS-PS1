const BASE = import.meta.env.VITE_API_URL || '';

export function getStoredToken() {
  return localStorage.getItem('traveloop_token');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('traveloop_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  const body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && typeof body === 'object' && !(body instanceof ArrayBuffer)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body:
      !isFormData && body !== undefined && typeof body === 'object' && !(body instanceof ArrayBuffer)
        ? JSON.stringify(body)
        : body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = typeof data === 'object' && data?.error ? data.error : res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
