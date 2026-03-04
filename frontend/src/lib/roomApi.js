// Fetch room info by ID
import { apiRequest } from './api'

export async function getRoomInfo(roomId) {
  // Try MongoDB-backed rooms first, fallback to in-memory meetings
  try {
    const data = await apiRequest(`/api/rooms/${roomId}`)
    return data.room || data
  } catch (err) {
    // Fallback to in-memory meetings endpoint
    return apiRequest(`/api/meetings/${roomId}`)
  }
}
