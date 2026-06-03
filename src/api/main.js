import { readToken } from '../utils/tokenStorage';
import { securedFetch } from '../utils/securedFetch';

const BASE = process.env.EXPO_PUBLIC_API_MAIN_URL || '';

async function getToken() {
  return readToken();
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await securedFetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function ensureDispatcher(id, displayName, token) {
  const t = token || (await getToken());
  const res = await securedFetch(`${BASE}/dispatchers/ensure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify({ id: String(id), displayName }),
  });
  return res.ok;
}

export async function fetchLoads({ page = 1, pageSize = 50, status, equipment, search } = {}) {
  const params = new URLSearchParams({ page, pageSize });
  if (status) params.set('status', status);
  if (equipment) params.set('equipment', equipment);
  if (search) params.set('search', search);
  const data = await apiFetch(`/loads?${params}`);
  return data?.items ?? data ?? [];
}

export async function fetchDrivers() {
  const data = await apiFetch('/drivers');
  return data ?? [];
}

export async function fetchActivity(dispatcherId, limit = 20) {
  const data = await apiFetch(`/activity?dispatcherId=${dispatcherId}&limit=${limit}`);
  return data ?? [];
}

export async function fetchDriverChat(driverId) {
  const data = await apiFetch(`/chat/${driverId}`);
  return data ?? [];
}

export async function sendChatMessage(driverId, message, dispatcherId) {
  return apiFetch(`/chat/${driverId}`, {
    method: 'POST',
    body: JSON.stringify({ message, senderId: dispatcherId, senderRole: 'dispatcher' }),
  });
}

export async function inviteDriver(name, contact, dispatcherId) {
  return apiFetch('/drivers/invite', {
    method: 'POST',
    body: JSON.stringify({ email: contact, dispatcherId, name }),
  });
}

export async function fetchActiveLoad(driverId) {
  const data = await apiFetch(`/loads/driver/${driverId}`);
  return data ?? null;
}

export async function fetchDriverMessages(driverId) {
  // `as_=driver&actorId=driverId` lets the backend filter out messages this
  // driver previously hid via "Delete for me" — without it, hidden messages
  // would re-appear on every poll.
  const params = new URLSearchParams({ as_: 'driver', actorId: String(driverId) });
  const data = await apiFetch(`/chat/${driverId}?${params}`);
  return data ?? [];
}

export async function sendDriverMessage(driverId, message, replyToMessageId) {
  return apiFetch(`/chat/${driverId}`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      senderId: driverId,
      senderRole: 'driver',
      replyToMessageId: replyToMessageId || null,
    }),
  });
}

// ─── Attachments (Phase 1 foundation) ──────────────────────────────────────
// Same direct-to-R2 flow as the web app: sign → PUT → POST /message with refs.

export async function signChatAttachment(driverId, { kind, mimeType, sizeBytes }) {
  return apiFetch(`/chat/${driverId}/attachments/sign`, {
    method: 'POST',
    body: JSON.stringify({ kind, mimeType, sizeBytes }),
  });
}

// On RN, `fetch(uri)` returns a Blob from a local file URI thanks to RN's
// network stack. We re-emit it as the PUT body so the signed URL receives the
// raw bytes — R2 doesn't accept multipart/form-data.
export async function uploadChatAttachment(uploadUrl, fileUri, mimeType) {
  const fileRes = await fetch(fileUri);
  const blob = await fileRes.blob();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType || 'application/octet-stream' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export async function sendChatMessageWithAttachments(driverId, { text, attachments, replyToMessageId, senderId, senderRole }) {
  return apiFetch(`/chat/${driverId}/message`, {
    method: 'POST',
    body: JSON.stringify({
      text: text || null,
      senderId: senderId || null,
      senderRole: senderRole || 'driver',
      replyToMessageId: replyToMessageId || null,
      attachments: attachments || [],
    }),
  });
}

export async function updateDriverStatus(driverId, status) {
  return apiFetch(`/drivers/${driverId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function sendDriverHeartbeat(driverId, { lat, lng, speedKph }) {
  return apiFetch(`/drivers/${driverId}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng, speedKph }),
  });
}

export async function acceptLoad(loadId, driverId) {
  return apiFetch(`/loads/${loadId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  });
}

export async function declineLoad(loadId, driverId, reason) {
  return apiFetch(`/loads/${loadId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ driverId, reason: reason ?? null }),
  });
}

export async function fetchDriver(driverId) {
  return apiFetch(`/drivers/${driverId}`);
}

export async function updateDriverSettings(driverId, settings) {
  return apiFetch(`/drivers/${driverId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

export async function fetchBrokerLoads(brokerId) {
  const data = await apiFetch(`/loads?brokerId=${brokerId}&pageSize=100`);
  return data?.items ?? data ?? [];
}

export async function postLoad(loadData) {
  return apiFetch('/loads', {
    method: 'POST',
    body: JSON.stringify(loadData),
  });
}

export async function deleteLoad(loadId) {
  return apiFetch(`/loads/${loadId}`, { method: 'DELETE' });
}

export async function fetchBrokerInquiries(brokerId) {
  const data = await apiFetch(`/inquiries?brokerId=${brokerId}`);
  return data ?? [];
}

export async function fetchInquiryThread(loadId, dispatcherId) {
  const data = await apiFetch(`/inquiries/${loadId}/${dispatcherId}`);
  return data ?? [];
}

export async function sendBrokerMessage(loadId, dispatcherId, text, brokerId) {
  return apiFetch(`/inquiries/${loadId}/${dispatcherId}`, {
    method: 'POST',
    body: JSON.stringify({ message: text, senderId: brokerId, senderRole: 'broker' }),
  });
}

export async function registerPushToken(driverId, pushToken) {
  return apiFetch(`/drivers/${driverId}/push-token`, {
    method: 'PATCH',
    body: JSON.stringify({ pushToken }),
  });
}

export async function uploadDeliveryPhoto(imageUri) {
  const token = await getToken();
  const fileName = `proof_${Date.now()}.jpg`;
  const formData = new FormData();
  formData.append('file', { uri: imageUri, name: fileName, type: 'image/jpeg' });

  const res = await securedFetch(`${BASE}/documents/upload-file`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed ${res.status}`);
  return res.json();
}

// Upload a recorded voice clip + waveform metadata to the chat thread.
// `audioUri` is the local file URI from expo-audio. Peaks are 0-100 ints.
export async function sendDriverVoiceMessage(driverId, { audioUri, mimeType, durationSeconds, peaks, fromDriver = true, replyToMessageId }) {
  const token = await getToken();
  const ext = mimeType?.includes('mp4') || mimeType?.includes('m4a') ? 'm4a'
    : mimeType?.includes('ogg') ? 'ogg'
    : mimeType?.includes('webm') ? 'webm'
    : 'aac';
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: `voice-${Date.now()}.${ext}`,
    type: mimeType || 'audio/mp4',
  });
  form.append('fromDriver', String(!!fromDriver));
  if (durationSeconds != null) form.append('durationSeconds', String(Math.round(durationSeconds)));
  if (peaks?.length) form.append('waveformPeaks', peaks.join(','));
  if (replyToMessageId) form.append('replyToMessageId', String(replyToMessageId));

  const res = await securedFetch(`${BASE}/chat/${driverId}/voice`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error(`Voice upload failed ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Compose a full audio URL for a backend-relative path like "/chat/messages/{id}/audio".
export function audioFullUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path}`;
}

// ─── Message interactions ────────────────────────────────────────────────────
// The backend accepts actor identity in the request body — mirrors the
// dispatcher-web flow and keeps these endpoints role-agnostic.

export async function editChatMessage(messageId, text, actor) {
  return apiFetch(`/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ text, actorRole: actor?.role || 'driver', actorId: actor?.id }),
  });
}

export async function deleteChatMessage(messageId, scope, actor) {
  return apiFetch(`/chat/messages/${messageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ scope, actorRole: actor?.role || 'driver', actorId: actor?.id }),
  });
}

export async function reactToChatMessage(messageId, emoji, actor) {
  return apiFetch(`/chat/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji, actorRole: actor?.role || 'driver', actorId: actor?.id }),
  });
}

export async function removeChatReaction(messageId, actor) {
  return apiFetch(`/chat/messages/${messageId}/reactions`, {
    method: 'DELETE',
    body: JSON.stringify({ actorRole: actor?.role || 'driver', actorId: actor?.id }),
  });
}

export async function confirmDelivery(loadId, driverId, userId, photoUrl, fileName, notes) {
  await apiFetch(`/loads/${loadId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Delivered' }),
  });

  if (photoUrl) {
    await apiFetch('/documents', {
      method: 'POST',
      body: JSON.stringify({
        type: 3,
        url: photoUrl,
        fileName: fileName || 'proof.jpg',
        contentType: 'image/jpeg',
        loadId,
        uploadedById: userId,
        notes: notes || null,
      }),
    });
  }
}
