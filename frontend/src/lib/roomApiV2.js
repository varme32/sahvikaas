import { apiRequest } from './api'

export async function createRoom({ name, subject, privacy, audio, video, scheduledFor, invitedMembers }) {
  return apiRequest('/api/rooms/create', {
    method: 'POST',
    body: { name, subject, privacy, audio, video, scheduledFor, invitedMembers },
  })
}

export async function joinRoom(roomId) {
  return apiRequest(`/api/rooms/${roomId}/join`, {
    method: 'POST',
  })
}

export async function endRoom(roomId) {
  return apiRequest(`/api/rooms/${roomId}/end`, {
    method: 'POST',
  })
}

export async function getActiveRooms() {
  return apiRequest('/api/rooms/', { method: 'GET' })
}

export async function getRoomInfo(roomId) {
  return apiRequest(`/api/rooms/${roomId}`, { method: 'GET' })
}

export async function getUserRoomHistory() {
  return apiRequest('/api/rooms/user/history', { method: 'GET' })
}

export async function getUserRoomStats() {
  return apiRequest('/api/rooms/user/stats', { method: 'GET' })
}
