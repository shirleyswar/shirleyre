import feed from '../public/agents/listings.json'
import { activeLacdbIndex, type LacdbListingStub } from './lacdbFlag'

const listings = (feed.listings ?? []) as LacdbListingStub[]

/** Active LACDB ids from the snapshot shipped with this build. */
export const LACDB_ACTIVE = activeLacdbIndex(listings)
