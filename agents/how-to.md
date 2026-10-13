# Agent instructions — Matthew Shirley listing feed

## What this is
A machine-readable feed of **Matthew Shirley** listings from the LACDB, hosted for other AI agents (tenant-rep bots, buyer bots). Firm: Saurage Rotenberg Commercial Real Estate.

## Read the feed
1. `GET /agents/listings.json` — array under `listings`, plus `generated_at`, attribution, and broker contact.
2. Filter locally by `transaction_type` (`sale` | `lease`), `status`, city, price, size.
3. Optional: `GET /agents/listings/{id}.json` for one record (use the 8-character LACDB id, e.g. `d2e5861f`).
4. Schema: `/agents/listing-record.schema.json`.

## Request a tour or OM
Use the `actions.request_tour` or `actions.request_om` mailto on each record, or email **matthew@sr-cre.com** with the listing id and address in the subject.

## Rules for agents
- Only use listings in this feed. Do not scrape LACDB or Resimplifi yourself.
- Keep the LACDB attribution line when you show listing data to a human.
- Never invent pricing or availability — if a field is null, ask Matthew.
