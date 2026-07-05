import axios from 'axios'

export interface Earthquake {
  id: string
  magnitude: number
  place: string
  time: number
  lat: number
  lng: number
  depth: number
  felt: number | null
  tsunami: number
  url: string
}

export async function getRecentEarthquakes(minMag = 2.5, limit = 50): Promise<Earthquake[]> {
  const { data } = await axios.get('https://earthquake.usgs.gov/fdsnws/event/1/query', {
    params: {
      format: 'geojson',
      minmagnitude: minMag,
      orderby: 'time',
      limit,
    },
    timeout: 10000
  })

  return (data.features || []).map((f: {
    id: string
    properties: { mag: number; place: string; time: number; felt: number | null; tsunami: number; url: string }
    geometry: { coordinates: [number, number, number] }
  }) => ({
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    depth: f.geometry.coordinates[2],
    felt: f.properties.felt,
    tsunami: f.properties.tsunami,
    url: f.properties.url
  }))
}

export async function getSignificantEarthquakes(): Promise<Earthquake[]> {
  const { data } = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson', {
    timeout: 10000
  })

  return (data.features || []).map((f: {
    id: string
    properties: { mag: number; place: string; time: number; felt: number | null; tsunami: number; url: string }
    geometry: { coordinates: [number, number, number] }
  }) => ({
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    depth: f.geometry.coordinates[2],
    felt: f.properties.felt,
    tsunami: f.properties.tsunami,
    url: f.properties.url
  }))
}
