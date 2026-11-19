/**
 * SIMULATED road routes for line-haul lanes (PA-21 map, PA-23 moving truck).
 * A real app would use the GPS / FASTag track (source §13). Waypoints follow
 * the main highway roughly; lanes without one are drawn hub to hub.
 */
import type { Point } from '@shared/engines/position'

export const LANE_WAYPOINTS: Record<string, (Point & { name: string })[]> = {
  // Gurugram → Agra → Gwalior → Sagar → Nagpur → Hyderabad → Raichur → Hosapete → Hubballi (NH44 / NH50)
  'LN-DEL-HBL': [
    { lat: 27.18, lng: 78.01, name: 'Agra' },
    { lat: 26.22, lng: 78.18, name: 'Gwalior' },
    { lat: 25.45, lng: 78.57, name: 'Jhansi' },
    { lat: 23.84, lng: 78.74, name: 'Sagar' },
    { lat: 21.15, lng: 79.09, name: 'Nagpur' },
    { lat: 19.67, lng: 78.53, name: 'Adilabad' },
    { lat: 17.39, lng: 78.49, name: 'Hyderabad' },
    { lat: 16.2, lng: 77.36, name: 'Raichur' },
    { lat: 15.27, lng: 76.39, name: 'Hosapete' },
  ],
}

/** Highway the route follows, for the trip header. */
export const LANE_VIA: Record<string, string> = { 'LN-DEL-HBL': 'NH44' }
