# Analytics

First-party only: no third-party scripts, no ad trackers, no IP addresses, no search text.
Admins see aggregates at `/admin/analytics`. Code: `src/server/analytics.ts` (recording),
`src/server/metrics.ts` (definitions), `src/app/api/track/route.ts` (browser beacons).

## What is recorded

| Event | Recorded by | When | Properties |
| --- | --- | --- | --- |
| `landing_viewed` | browser beacon | landing page shown | none |
| `search_performed` | browser beacon | ticket search with at least one filter | number of filters, result count |
| `event_viewed` | browser beacon | event page shown | event id |
| `listing_viewed` | browser beacon | someone else's listing shown | listing + event id |
| `listing_created` | server | listing saved | format, intent (draft/publish) |
| `listing_published` | server | listing went live or to review | whether review was needed |
| `listing_edited` | server | seller edited | |
| `listing_closed` | server | marked sold/unavailable or deleted | action |
| `inquiry_created` | server | buyer's request recorded | quantity |
| `inquiry_accepted` | server | seller shared contact | |
| `outcome_confirmed` | server | a party recorded an outcome | party, outcome |
| `report_submitted` | server | report recorded | reason |
| `report_resolved` | server | moderator resolved/dismissed | outcome |
| `email_verified` | server | first verified sign-in | |
| `signed_in` | server | each sign-in | |

Signed-in events carry the account id. Signed-out visitors get a random first-party cookie id
(`restix_aid`, 180 days) and only ever produce `landing_viewed`; browsers sending Global Privacy
Control or Do Not Track get no id and are not counted. Beacons are de-duplicated per tab
session and rate limited; they are approximate by nature. Outcome metrics use server-recorded
events and database rows, which are authoritative.

## Metric definitions

All metrics use a half-open date range `[from, to)` in UTC days, chosen on the dashboard.
**Listings on events flagged `is_fixture` (sample data) are excluded everywhere.**

| Metric | Definition |
| --- | --- |
| Verified accounts | profiles with `email_verified_at` set (all time); "new in range" by `created_at` |
| Active students | distinct account ids with any analytics event in range (unique users, not views) |
| Students active on 2+ days | of active students, those with events on two or more distinct days; shown with counts |
| Listings published | listings with `published_at` in range |
| Listings created | listings with `created_at` in range; "events" = distinct events among them |
| Contact requests | inquiries created in range; "accepted" = those accepted (status accepted/closed with a response) |
| Listings with at least one request | of listings published in range, those with at least one inquiry ever; shown as % with numerator/denominator |
| Median time to first request | median of (first inquiry - published_at) over those listings |
| Reports per 100 listings | reports created in range / listings created in range x 100; dash when no listings |
| Median time to close a report | median of (resolved_at - created_at) for reports closed in range |
| Reported outcomes | confirmations in range by party and outcome |
| Both sides confirmed a handover | inquiries where buyer and seller both recorded `completed`, the later one in range |
| Status now | every non-sample listing by its effective status today (expiry and cancellations applied) |
| Page views / unique viewers | event counts and distinct account-or-anonymous ids for view events in range |

## Limitations (read before quoting numbers)

- **Nothing about payment or handover is observed.** "Both sides confirmed a handover" is the
  strongest signal ResTix has, and it is self-reported. A click on "Ask the seller" is never
  counted as a transaction.
- View counts are approximate (ad blockers, private browsing, GPC/DNT, sessionStorage
  de-duplication).
- Deleting an account removes its analytics link (`user_id` set null); historical counts remain.
- Analytics older than 18 months are deleted by the daily maintenance job.
- No sample or backfilled data: an empty range shows zeros and dashes.
