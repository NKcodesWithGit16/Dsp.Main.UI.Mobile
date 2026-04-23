const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

export async function login(usernameOrEmail, password) {
  const res = await fetch(`${BASE_URL}/api/Auth/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || 'Login failed');
  return data;
}

export async function registerAccount(data) {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'Registration failed');
  return res.json();
}
