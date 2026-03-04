/**
 * Crystal Profile Registry
 *
 * Central lookup for crystal profiles. Import getProfile() to
 * resolve a CrystalType to its full parameter set.
 */

import type { CrystalProfile, CrystalType } from '../types'
import { agateProfile } from './agate'
import { tourmalineProfile } from './tourmaline'

const profiles: Record<CrystalType, CrystalProfile> = {
  agate: agateProfile,
  tourmaline: tourmalineProfile,
}

export const DEFAULT_CRYSTAL_TYPE: CrystalType = 'agate'

export function getProfile(type: CrystalType): CrystalProfile {
  return profiles[type]
}

export function getAvailableTypes(): CrystalType[] {
  return Object.keys(profiles) as CrystalType[]
}
