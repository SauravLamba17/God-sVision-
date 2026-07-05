import { NextResponse } from 'next/server'
import { getVesselSnapshot } from '@/lib/apis/ships'

// Note: Real-time AIS WebSocket requires AISSTREAM_KEY in .env.local
// Free tier at aisstream.io — connect once server-side for live tracking
export async function GET() {
  const key = process.env.AISSTREAM_KEY
  if (!key || key === 'your_key_from_aisstream.io') {
    // Return mock vessels for demo when no key configured
    const mockVessels = [
      { mmsi:'123456789', shipName:'EVER GIVEN',    lat:30.2,  lng:32.6,  speed:14.2, heading:355, shipType:70, timestamp:Date.now() },
      { mmsi:'234567890', shipName:'MSC OSCAR',     lat:51.3,  lng:3.1,   speed:12.8, heading:210, shipType:70, timestamp:Date.now() },
      { mmsi:'345678901', shipName:'ARCTIC SUNRISE', lat:78.2,  lng:15.4,  speed:8.1,  heading:90,  shipType:52, timestamp:Date.now() },
      { mmsi:'456789012', shipName:'PIONEER SPIRIT', lat:52.0,  lng:4.5,   speed:6.0,  heading:175, shipType:89, timestamp:Date.now() },
      { mmsi:'567890123', shipName:'QUEEN MARY 2',  lat:40.7,  lng:-74.0, speed:22.5, heading:65,  shipType:60, timestamp:Date.now() },
    ]
    return NextResponse.json({
      data: mockVessels,
      count: mockVessels.length,
      connected: false,
      note: 'Add AISSTREAM_KEY to .env.local for live tracking. Free at aisstream.io',
    })
  }

  const snapshot = getVesselSnapshot()
  return NextResponse.json({
    data: snapshot.vessels,
    count: snapshot.count,
    connected: snapshot.connected,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
