// Self-check for the flight presentation helpers.
// Run: node lib/flights.check.ts   (Node >=23 strips the types natively)
import assert from 'node:assert/strict'
import { altitudeBand, formatVerticalRate, formatLastContact, inBounds, matchesSearch } from './flights.ts'
import type { Aircraft } from './flights.ts'
import { sane } from './apis/opensky.ts'

const base: Aircraft = {
  icao24: 'a1b2c3', callsign: 'AAL123', originCountry: 'United States',
  longitude: -80, latitude: 40, altitude: 35000, onGround: false,
  velocity: 450, heading: 270, verticalRate: 0, squawk: '1200', lastContact: null,
}

// --- altitude bands -------------------------------------------------------
assert.equal(altitudeBand({ altitude: 35000, onGround: false }).color, '#2196f3', 'cruise = blue')
assert.equal(altitudeBand({ altitude: 20000, onGround: false }).color, '#00e676', 'mid = green')
assert.equal(altitudeBand({ altitude: 5000, onGround: false }).color, '#ffd600', 'low = yellow')
assert.equal(altitudeBand({ altitude: 0, onGround: true }).label, 'ON GROUND', 'ground wins over altitude')
// A null altitude must NOT fall through to a cruise colour — it is unknown.
assert.equal(altitudeBand({ altitude: null, onGround: false }).label, 'ON GROUND')

// --- sane(): bounds + honest rounding ------------------------------------
// Unit conversion is what makes this necessary: 10668 m is exactly 35,000 ft,
// but 10668 * 3.28084 lands on 35000.00112.
assert.equal(sane(10668 * 3.28084, -1500, 60000), 35000, 'conversion artefact rounded off')
assert.equal(sane(172.06 * 1.94384, 0, 700), 334, 'speed rounds to whole knots')
assert.equal(sane(103.47, 0, 360, 1), 103.5, 'heading keeps one decimal')
// Physically impossible decodes must read as unknown, never as a fact.
assert.equal(sane(483.5, 0, 360), null, 'track beyond 360 is a corrupt decode')
assert.equal(sane(3342, 0, 700), null, 'ground speed of 3,342 kts is a corrupt decode')
assert.equal(sane(null, 0, 360), null)
assert.equal(sane(NaN, 0, 360), null, 'NaN is unknown, not 0')
assert.equal(sane(0, 0, 700), 0, 'a real zero survives')

// --- vertical rate --------------------------------------------------------
assert.equal(formatVerticalRate(null), null, 'absent stays absent, never "0"')
assert.equal(formatVerticalRate(0), 'LEVEL')
assert.equal(formatVerticalRate(50), 'LEVEL', 'noise below 100 ft/min reads as level')
assert.match(formatVerticalRate(1200)!, /CLIMB 1,200 ft\/min/)
assert.match(formatVerticalRate(-1800)!, /DESCEND 1,800 ft\/min/)

// --- last contact (epoch SECONDS, not ms) ---------------------------------
assert.equal(formatLastContact(null), null)
const nowSec = Math.floor(Date.now() / 1000)
assert.match(formatLastContact(nowSec - 30)!, /^3[01]s ago$/)
assert.match(formatLastContact(nowSec - 300)!, /^5m ago$/)
assert.match(formatLastContact(nowSec - 7200)!, /^2h ago$/)

// --- viewport filtering ---------------------------------------------------
const box = { minLat: 35, maxLat: 45, minLon: -85, maxLon: -75 }
assert.equal(inBounds(base, box), true)
assert.equal(inBounds({ ...base, latitude: 10 }, box), false)
assert.equal(inBounds({ ...base, latitude: null }, box), false, 'no position = not renderable')

// --- search ---------------------------------------------------------------
assert.equal(matchesSearch(base, 'aal'), true, 'callsign match is case-insensitive')
assert.equal(matchesSearch(base, 'A1B2'), true, 'icao24 match is case-insensitive')
assert.equal(matchesSearch(base, 'BAW'), false)
assert.equal(matchesSearch(base, '   '), true, 'blank search matches everything')

console.log('flights.check.ts: all assertions passed')
