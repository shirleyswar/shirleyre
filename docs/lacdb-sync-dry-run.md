# LACDB → War Room deals dry run

Run: 2026-10-13T14:39:21.284Z. Mode: **dry-run**. No Supabase write was sent.

Feed: `public/agents/listings.json` generated 2026-10-05T12:30:00Z. 19 records (9 full, 10 summary). 18 status=active, 1 not active.

Deals read: 47 (`lib/supabase.ts public client (no env vars set); GET only`). Economics rows: 20. Deadline rows counted: 33. Requests: 3 GET, 0 writes.

## Counts

| Outcome | Listings | Deals |
| --- | ---: | ---: |
| CREATE | 4 | 3 |
| UPDATE | 13 | 9 |
| UNCHANGED (matched, no writable diff) | 0 | 0 |
| REVIEW (not created or updated) | 1 | 2 candidates, none chosen |
| Off LACDB (tag, never delete) | — | 7 |

CREATE and UPDATE deals are the sync result. Off LACDB is a tag list, not a delete. UNCHANGED rows already agree on the fields this script is allowed to write.

## Per-listing table

| LACDB id | Detail | Tx | Address | Action | Deal |
| --- | --- | --- | --- | --- | --- |
| 30f8f0a3 | summary | sale | Between N 13th and N 14th St, Baton Rouge | CREATE | — |
| 5d4a0303 | full | sale | 5229 Government St, Baton Rouge | UPDATE | Daniel Laborde · Government St. 5219 · under_contract · active_listing |
| 0b5ed2a7 | summary | sale | 460 Community College Dr, Baton Rouge | UPDATE | Anthony Kimble · Community College Dr. 460 · pipeline · active_listing |
| d2e5861f | full | sale | 1400 -1500 Wooddale Blvd, Baton Rouge | UPDATE | UPals · Wooddale Blvd. 1400 · active · active_listing |
| d36904f1 | full | lease | 12025 Industriplex Blvd, Baton Rouge | UPDATE | Industriplex Blvd. 12025 · Industriplex Blvd., , 12025 · under_contract · listing |
| c10c62e0 | full | sale | 5235 Government St, Baton Rouge | CREATE | — |
| 7b1ff984 | summary | lease | 5229 Government St, Baton Rouge | UPDATE | Daniel Laborde · Government St. 5219 · under_contract · active_listing |
| 7eb337d8 | full | lease | 619 Jefferson Hwy, Baton Rouge | REVIEW | — |
| 5296eedb | summary | sale | North Morrison Blvd, Hammond | CREATE | — |
| b6e3c879 | summary | lease | 25035 LA-1, Plaquemine | UPDATE | Hank Saurage · LA-1 25035 · pipeline · active_listing |
| 138d8815 | full | sale | 1301 Hudson Ln, Monroe | UPDATE | Charles Cooper · Hudson Ln. 1301 · active · active_listing |
| e0963f9a | full | sale | 4109 Government St, Baton Rouge | UPDATE | Food Bank · Government St. 4109 · active · active_listing |
| 9a59f849 | summary | lease | North Morrison Blvd, Hammond | CREATE | — |
| fa9c3a67 | summary | sale | 25035 LA-1, Plaquemine | UPDATE | Hank Saurage · LA-1 25035 · pipeline · active_listing |
| 600d975e | summary | lease | 25035 LA-1, Plaquemine | UPDATE | Hank Saurage · LA-1 25035 · pipeline · active_listing |
| fe0c270f | full | sale | 328 Desiard St, Monroe | UPDATE | The Annex · DeSiard St. 328 · Monroe · pipeline · active_listing |
| 11940dde | full | sale | Tract A-2-A-4-1-B, Baton Rouge | UPDATE | Windy Gladney · Burbank · active · active_listing |
| fca1102d | summary | sale | Tract A-2-A-4-1-B, Baton Rouge | UPDATE | Windy Gladney · Burbank · active · active_listing |

## CREATE

### Between N 13th and N 14th St (30f8f0a3)

Proposed `deals` insert (not sent):

```json
{
  "name": "Between N 13th and N 14th St",
  "address": "Between N 13th and N 14th St",
  "addr_display": "Between N 13th and N 14th St",
  "addr_number": null,
  "addr_street_name": null,
  "addr_street_type": null,
  "addr_direction": null,
  "addr_city": "Baton Rouge",
  "addr_state": "LA",
  "addr_zip": "70802",
  "property_type": null,
  "status": "active",
  "type": "listing",
  "representation_role": "landlord",
  "lacdb_url": "https://lacdb.resimplifi.com/listings/30f8f0a3-048-acres-c2-vacant-land",
  "photo_url": null,
  "acreage": null,
  "deal_source": "lacdb:30f8f0a3"
}
```

Proposed `deal_economics` insert (commission percents omitted):

```json
{
  "transaction_type": "sale",
  "asking_price": 78000,
  "sqft": null,
  "land_sqft": null,
  "lease_rate_psf": null,
  "property_type": null
}
```

Gaps:

- 30f8f0a3: property_types empty (summary stub or unset on LACDB)
- 30f8f0a3: no house number — filing name falls back to the LACDB street line

### Government St. 5235 (c10c62e0)

Proposed `deals` insert (not sent):

```json
{
  "name": "Government St. 5235",
  "address": "Government St. 5235",
  "addr_display": "Government St. 5235",
  "addr_number": "5235",
  "addr_street_name": "Government",
  "addr_street_type": "St.",
  "addr_direction": null,
  "addr_city": "Baton Rouge",
  "addr_state": "LA",
  "addr_zip": "70816",
  "property_type": "LAND",
  "status": "active",
  "type": "listing",
  "representation_role": "landlord",
  "lacdb_url": "https://lacdb.resimplifi.com/listings/c10c62e0-261-acres-c1-no-flood-build-ready",
  "photo_url": "https://storage.googleapis.com/resimplifi-associate/lacdb/images/c10c62e0/261-acres-c1-no-flood-build-ready-00dd1117.webp",
  "acreage": 2.61,
  "deal_source": "lacdb:c10c62e0"
}
```

Proposed `deal_economics` insert (commission percents omitted):

```json
{
  "transaction_type": "sale",
  "asking_price": 1672000,
  "sqft": 113692,
  "land_sqft": 113692,
  "lease_rate_psf": null,
  "property_type": "LAND"
}
```

### North Morrison Blvd (5296eedb, 9a59f849)

Proposed `deals` insert (not sent):

```json
{
  "name": "North Morrison Blvd",
  "address": "North Morrison Blvd",
  "addr_display": "North Morrison Blvd",
  "addr_number": null,
  "addr_street_name": null,
  "addr_street_type": null,
  "addr_direction": null,
  "addr_city": "Hammond",
  "addr_state": "LA",
  "addr_zip": "70401",
  "property_type": null,
  "status": "active",
  "type": "listing",
  "representation_role": "landlord",
  "lacdb_url": "https://lacdb.resimplifi.com/listings/5296eedb-buildready-20-acres-on-hwy-51",
  "photo_url": null,
  "acreage": null,
  "deal_source": "lacdb:5296eedb"
}
```

Proposed `deal_economics` insert (commission percents omitted):

```json
{
  "transaction_type": "sale",
  "asking_price": 1267455,
  "sqft": null,
  "land_sqft": null,
  "lease_rate_psf": null,
  "property_type": null
}
```

Gaps:

- 5296eedb: property_types empty (summary stub or unset on LACDB)
- 5296eedb: no house number — filing name falls back to the LACDB street line
- 9a59f849: price label "$12 - $22 SF/year" is not a single total
- 9a59f849: summary rate label "$12 - $22 SF/year" is a range or not $/SF/year
- 9a59f849: property_types empty (summary stub or unset on LACDB)
- 9a59f849: no house number — filing name falls back to the LACDB street line
- grouped 2 LACDB records on one deal; deal_source can store one id (5296eedb)

## UPDATE

### Daniel Laborde · Government St. 5219 · under_contract · active_listing

Matched by lacdb id. Listings: 5d4a0303, 7b1ff984. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/5d4a0303-084-acres-lit-hard-corner-c1-no-flood-buildready |
| deals.acreage | ∅ | 0.84 |
| deals.addr_number — same street, house number differs from the LACDB record this deal already points at | 5219 | 5229 |
| deals.addr_display — filing display follows the LACDB house number | Government St. 5219 | Government St. 5229 |
| deals.address — house number only; the rest of the stored address stays | 5219 Government St, Baton Rouge, LA 70806, USA | 5229 Government St, Baton Rouge, LA 70806, USA |
| deals.addr_state | ∅ | LA |
| deal_economics.land_sqft | ∅ | 36,590 |

Protected on this row: notes empty, deadlines 6, sale commission present, lease commission present, dropbox present.

Not written:

- 5d4a0303: photos are named with a different listing's street number, not 5229; photo_url not set
- 7b1ff984: price label "$1 SF/year" is not a single total
- 7b1ff984: summary stub rate "$1 SF/year" kept out of lease_rate_psf
- 7b1ff984: property_types empty (summary stub or unset on LACDB)
- grouped 2 LACDB records on one deal; deal_source can store one id (5d4a0303)
- ZIP disagrees across records (70806 vs 70816) — addr_zip not written

### Anthony Kimble · Community College Dr. 460 · pipeline · active_listing

Matched by lacdb id. Listings: 0b5ed2a7. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/0b5ed2a7-177-acres-c1-no-flood-buildready |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 70806 |

Protected on this row: notes empty, deadlines 0, sale commission present, lease commission present, dropbox empty.

Not written:

- 0b5ed2a7: property_types empty (summary stub or unset on LACDB)

### UPals · Wooddale Blvd. 1400 · active · active_listing

Matched by lacdb id. Listings: d2e5861f. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/d2e5861f-1293-acres-cw3-dual-access-cleared-buildready |
| deals.photo_url — first LACDB photo URL; not uploaded to the deal-photos bucket | ∅ | https://storage.googleapis.com/resimplifi-associate/lacdb/images/d2e5861f/1293-acres-cw3-dual-access-cleared-buildready-3dd63858.webp |
| deals.acreage | ∅ | 12.933 |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 70806 |
| deal_economics.asking_price | 3,200,000 | 2,957,000 |
| deal_economics.land_sqft | ∅ | 563,361 |

Protected on this row: notes empty, deadlines 0, sale commission present, lease commission present, dropbox present.

### Industriplex Blvd. 12025 · Industriplex Blvd., , 12025 · under_contract · listing

Matched by lacdb id. Listings: d36904f1. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.acreage | ∅ | 0.6991 |
| deals.addr_display — display has broken punctuation; slots are unchanged | Industriplex Blvd., , 12025 | Industriplex Blvd. 12025 |
| deal_economics.land_sqft | ∅ | 30,453 |

Protected on this row: notes empty, deadlines 0, sale commission empty, lease commission present, dropbox present.

Not written:

- d36904f1: lease rate range 11–13 sfYear; lease_rate_psf not written

### Hank Saurage · LA-1 25035 · pipeline · active_listing

Matched by lacdb id. Listings: b6e3c879, fa9c3a67, 600d975e. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/fa9c3a67-shovelready-site-near-dow-shintech-iberville-parish |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 70764 |

Protected on this row: notes empty, deadlines 0, sale commission present, lease commission present, dropbox empty.

Not written:

- b6e3c879: price label "$10 - $13 Month" is not a single total
- b6e3c879: summary rate label "$10 - $13 Month" is a range or not $/SF/year
- b6e3c879: property_types empty (summary stub or unset on LACDB)
- fa9c3a67: property_types empty (summary stub or unset on LACDB)
- 600d975e: price label "$10 - $13 SF/year" is not a single total
- 600d975e: summary rate label "$10 - $13 SF/year" is a range or not $/SF/year
- 600d975e: property_types empty (summary stub or unset on LACDB)
- grouped 3 LACDB records on one deal; deal_source can store one id (fa9c3a67)

### Charles Cooper · Hudson Ln. 1301 · active · active_listing

Matched by address. Listings: 138d8815. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/138d8815-leased-office-acredit-tenant |
| deals.photo_url — first LACDB photo URL; not uploaded to the deal-photos bucket | ∅ | https://storage.googleapis.com/resimplifi-associate/lacdb/images/138d8815/1301-hudson-ln-c4f186e6.webp |
| deals.acreage | ∅ | 1.879 |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 71201 |
| deal_economics.land_sqft | ∅ | 81,849 |

Protected on this row: notes empty, deadlines 0, sale commission present, lease commission present, dropbox present.

### Food Bank · Government St. 4109 · active · active_listing

Matched by lacdb id. Listings: e0963f9a. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/e0963f9a-reduced-motivated-05-acre-tract-w-100-frontage |
| deals.photo_url — first LACDB photo URL; not uploaded to the deal-photos bucket | ∅ | https://storage.googleapis.com/resimplifi-associate/lacdb/images/e0963f9a/-05-acre-tract-w-100-frontage-312af8de.webp |
| deals.acreage | ∅ | 0.49 |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 70806 |
| deal_economics.asking_price | ∅ | 339,000 |
| deal_economics.sqft | ∅ | 21,344 |
| deal_economics.land_sqft | ∅ | 21,344 |
| deal_economics.transaction_type | ∅ | sale |

Protected on this row: notes empty, deadlines 0, sale commission empty, lease commission empty, dropbox present.

### The Annex · DeSiard St. 328 · Monroe · pipeline · active_listing

Matched by address. Listings: fe0c270f. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/fe0c270f-the-annex |
| deals.photo_url — first LACDB photo URL; not uploaded to the deal-photos bucket | ∅ | https://storage.googleapis.com/resimplifi-associate/lacdb/images/fe0c270f/the-annex-courtyard-3bcf55c2.webp |
| deals.acreage | ∅ | 0.491 |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 71201 |
| deal_economics.asking_price | ∅ | 2,000,000 |
| deal_economics.sqft | ∅ | 24,464 |
| deal_economics.land_sqft | ∅ | 21,388 |
| deal_economics.transaction_type | ∅ | sale |

Protected on this row: notes empty, deadlines 0, sale commission empty, lease commission empty, dropbox empty.

### Windy Gladney · Burbank · active · active_listing

Matched by lacdb id. Listings: 11940dde, fca1102d. Status, type, client name, notes, deadlines, and commission stay as they are.

| Field | From | To |
| --- | --- | --- |
| deals.lacdb_url | ∅ | https://lacdb.resimplifi.com/listings/fca1102d-zoned-mx3-finalized-siteready-65-useable-acres |
| deals.photo_url — first LACDB photo URL; not uploaded to the deal-photos bucket | ∅ | https://storage.googleapis.com/resimplifi-associate/lacdb/images/11940dde/tract-a2a41b-c98b9de7.webp |
| deals.addr_state | ∅ | LA |
| deals.addr_zip | ∅ | 70810 |

Protected on this row: notes empty, deadlines 0, sale commission present, lease commission present, dropbox empty.

Not written:

- 11940dde: price is $10.4/SF with total range 453460–2947487; not written to asking_price
- 11940dde: lot acres 1–6.5; acreage not collapsed to one number
- 11940dde: lot sf 43560–283140; land_sqft not collapsed
- 11940dde: no house number — filing name falls back to the LACDB street line
- fca1102d: property_types empty (summary stub or unset on LACDB)
- fca1102d: no house number — filing name falls back to the LACDB street line
- grouped 2 LACDB records on one deal; deal_source can store one id (fca1102d)
- matched without the same normalized address (Burbank vs Tract A-2-A-4-1-B); address columns left as stored

## Off LACDB

These listing deals store an LACDB id that is not in the current feed. The row stays. Status is not changed. `deal_source` is not rewritten, because that column is how the id is stored and there is no tag column.

| Deal | Status | Type | Stored id | Notes | Deadlines |
| --- | --- | --- | --- | --- | ---: |
| Debbie Guerin · Bluebonnet Blvd. 5139 · under_contract · active_listing | under_contract | active_listing | d18319c8 | present, kept | 0 |
| Frey Family · Government St. 4950 · closed · active_listing | closed | active_listing | 0a0efbcb | empty | 5 |
| Cabela's Pkwy. S. 2703 · Cabela's Pkwy. S. 2703 · hot · listing | hot | listing | 9565431c | present, kept | 0 |
| Wade Iverstine · Government St. 1600 · closed · listing | closed | listing | 6a828b08 | empty | 5 |
| Blue Cross / Blue Shield · Reitz Ave. 5525 · pending_payment · landlord | pending_payment | landlord | 68ecb195 | empty | 1 |
| William Evans · S Foster Dr. 545 · active · active_listing | active | active_listing | 79383c2a | empty | 0 |
| Choctaw Dr. S. 13327 · Choctaw Dr. S. 13327 · active · listing | active | listing | 3f70d51f | empty | 1 |

Tag to apply later: **Off LACDB**. Delete: no.

LACDB ids on deals that are not listings were not tagged:

- Burnham · 13327 S. Choctaw Dr. S. · active · buyer — stored id 3f70d51f

## REVIEW

- **7eb337d8** 619 Jefferson Hwy — address ambiguous: Bob Belk · Jefferson Hwy. 619, Suite 2-G · active · active_listing; Bob Belk · Jefferson Hwy. 619, Suite 1-D · active · active_listing
- Resolved 13 Oct 2026, after this dry run: the listing is Suite 2H. The Suite 2-G row is that suite. Suite 1-D is leased and is not written. The write is in `docs/lacdb-sync-applied.md`.

## Not active on the feed

- **118b7fa2** status pending — Interstate 12 Service Road. Left unchanged. address: RaceTrac · I-12 Service Rd. · under_contract · listing. Not Off LACDB; the record is still in the feed.

## Field-mapping gaps

- No generator script is in the repo. `public/agents/listings.json` is the PR 16 one-time export (`generated_at` above). This dry run did not pull LACDB again.
- The feed excludes co-listed ids 1228a65b, 2471e47a, 3da3426b, 8b786eb4. They are not created and are not tagged Off LACDB unless a deal already stores one of those ids.
- `related_listing_ids` is empty on these records. Same-address sale and lease records are grouped here; the schema has one `deal_source` / one `lacdb_url` per deal.
- Summary stubs often have no `property_types`, no `size`, and a price label instead of `price.amount`. Empty feed fields do not clear a deal.
- `asking_price` is written only for a single total. `$ /SF` ranges (land splits) and conflicting totals are left out.
- `lease_rate_psf` is written only for one `$/SF/year` figure. Ranges (`$12 - $22 SF/year`) and `$ /Month` labels are left out. A summary stub rate is left out.
- Leased spaces are ignored. Available spaces with different rates are left out.
- Land lot sf is proposed as `deal_economics.sqft` when there is no building sf, because existing land deals already store lot sf there, and also as `land_sqft`. Acreage goes to `deals.acreage` only when min and max agree.
- `photo_url` would be the LACDB CDN url. The deal form uploads into the `deal-photos` bucket. This dry run does not download or upload photos. An existing photo is kept.
- There is no Off LACDB column. `deals.emoji` does not exist. Putting the tag in `deal_source` would erase `lacdb:<id>`. The tag is the report, not a column write.
- New deals would use `type: listing` and `representation_role: landlord`, which is what the deal form writes. Older rows use `active_listing`. Existing type and status are not remapped.
- `deals.property_type` allows INDUSTRIAL, LAND, OFFICE, OTHER, RETAIL. The form also offers MULTIFAMILY; this feed has none.
- House-number mismatches are a diff only when the deal already stores that LACDB id and the street name matches. A different place name (a tract legal description versus a name already on the deal) is not overwritten.
- Client `name` is never overwritten. Notes, contract deadlines, and every commission column are omitted from every payload.

## Protected columns

- deals.notes
- deals.commission_rate
- deals.commission_estimated
- deals.commission_collected
- deals.name (client name on an existing row)
- deals.status
- deals.type
- deals.representation_role
- deals.dropbox_link
- deals.rating
- deals.deal_source when it is a user label (anything other than lacdb:<id>)
- deal_economics.sale_commission_pct
- deal_economics.lease_commission_pct
- contract_deadlines (every row)

## Run

```
node scripts/lacdb-sync.mjs
node scripts/lacdb-sync.mjs --dry-run
node scripts/lacdb-sync.mjs --apply
```

`--apply` exits without sending a write. `--dry-run` is the default.
