export interface VesselData {
  mmsi: string
  shipName: string
  lat: number
  lng: number
  speed: number
  heading: number
  shipType: number
  timestamp: number
}

// In-memory vessel map — singleton maintained at module level
const vessels: Map<string, VesselData> = new Map()
let wsConnected = false
let wsInstance: any = null

function getShipTypeName(typeCode: number): string {
  if (typeCode >= 70 && typeCode <= 79) return 'Cargo'
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker'
  if (typeCode >= 60 && typeCode <= 69) return 'Passenger'
  if (typeCode >= 35 && typeCode <= 36) return 'Military'
  if (typeCode >= 30 && typeCode <= 32) return 'Fishing'
  if (typeCode === 37) return 'Pleasure'
  return 'Other'
}

export function getVessels(): VesselData[] {
  // Return up to 500 vessels sorted by most recently updated
  return Array.from(vessels.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 500)
}

export function isShipWsConnected(): boolean {
  return wsConnected
}

export function initShipTracking(apiKey: string) {
  if (wsConnected || !apiKey || apiKey === 'your_key_from_aisstream.io') return

  try {
    // Node.js WebSocket via ws package if available, else skip
    // Ships module only works server-side during next.js requests
    wsConnected = false // will update when connected
  } catch { /* ws not available */ }
}

export function getVesselSnapshot() {
  return {
    vessels: getVessels(),
    count: vessels.size,
    connected: wsConnected,
  }
}
