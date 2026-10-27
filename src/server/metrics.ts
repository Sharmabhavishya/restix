import "server-only";
import { asUser } from "./db";

// Every figure here is defined in docs/ANALYTICS.md. Listings on development fixture
// events are excluded so sample data can never pass as adoption.

export interface Range {
  from: Date;
  to: Date;
}

export interface Ratio {
  numerator: number;
  denominator: number;
}

export interface Metrics {
  range: Range;
  accounts: { total: number; verified: number; newInRange: number };
  activeUsers: number;
  repeatUsers: Ratio;
  views: { name: string; views: number; uniqueViewers: number }[];
  searches: number;
  listings: { createdInRange: number; publishedInRange: number; uniqueEvents: number };
  listingStatusNow: Record<string, number>;
  listingsByEvent: { name: string; count: number }[];
  listingsByFormat: { format: string; count: number }[];
  inquiryConversion: Ratio;
  medianHoursToFirstInquiry: number | null;
  inquiries: { created: number; accepted: number };
  reports: { submitted: number; ratePer100Listings: number | null; open: number };
  moderation: { medianHoursToResolve: number | null; resolvedInRange: number };
  outcomes: { party: string; outcome: string; count: number }[];
  bothConfirmedCompleted: number;
  daily: { day: string; listings: number; inquiries: number }[];
}

export async function computeMetrics(adminId: string, range: Range): Promise<Metrics> {
  const { from, to } = range;
  return asUser(adminId, async (tx) => {
    const [accounts] = await tx<{ total: number; verified: number; newInRange: number }[]>`
      select count(*)::int as total,
             count(*) filter (where email_verified_at is not null)::int as verified,
             count(*) filter (where created_at >= ${from} and created_at < ${to})::int as new_in_range
      from restix.profiles`;

    const [usage] = await tx<{ activeUsers: number; repeatUsers: number; searches: number }[]>`
      with days as (
        select user_id, count(distinct occurred_at::date) as d
        from restix.analytics_events
        where user_id is not null and occurred_at >= ${from} and occurred_at < ${to}
        group by user_id
      )
      select (select count(*)::int from days) as active_users,
             (select count(*)::int from days where d >= 2) as repeat_users,
             (select count(*)::int from restix.analytics_events
               where name = 'search_performed' and occurred_at >= ${from} and occurred_at < ${to}) as searches`;

    const views = await tx<{ name: string; views: number; uniqueViewers: number }[]>`
      select name, count(*)::int as views, count(distinct coalesce(user_id, anon_id))::int as unique_viewers
      from restix.analytics_events
      where name in ('landing_viewed', 'event_viewed', 'listing_viewed') and occurred_at >= ${from} and occurred_at < ${to}
      group by name order by name`;

    // Listings that count: not on a fixture event.
    const real = tx`restix.ticket_listings l join restix.events e on e.id = l.event_id and not e.is_fixture`;

    const [listings] = await tx<{ createdInRange: number; publishedInRange: number; uniqueEvents: number }[]>`
      select count(*) filter (where l.created_at >= ${from} and l.created_at < ${to})::int as created_in_range,
             count(*) filter (where l.published_at >= ${from} and l.published_at < ${to})::int as published_in_range,
             count(distinct l.event_id) filter (where l.created_at >= ${from} and l.created_at < ${to})::int as unique_events
      from ${real}`;

    const statusRows = await tx<{ status: string; count: number }[]>`
      select case when l.status in ('active', 'paused', 'pending_review', 'draft') and
                       (l.expires_at <= now() or coalesce(e.ends_at, e.starts_at) <= now()) then 'expired'
                  when l.status = 'active' and e.status = 'cancelled' then 'unavailable'
                  else l.status end as status,
             count(*)::int as count
      from ${real} group by 1`;

    const listingsByEvent = await tx<{ name: string; count: number }[]>`
      select e.name, count(*)::int as count from ${real}
      where l.created_at >= ${from} and l.created_at < ${to}
      group by e.name order by count desc, e.name limit 8`;

    const listingsByFormat = await tx<{ format: string; count: number }[]>`
      select l.format, count(*)::int as count from ${real}
      where l.created_at >= ${from} and l.created_at < ${to}
      group by l.format order by count desc`;

    const [conversion] = await tx<{ numerator: number; denominator: number; medianHours: number | null }[]>`
      with published as (
        select l.id, l.published_at,
               (select min(i.created_at) from restix.inquiries i where i.listing_id = l.id) as first_inquiry
        from ${real}
        where l.published_at >= ${from} and l.published_at < ${to}
      )
      select count(*) filter (where first_inquiry is not null)::int as numerator,
             count(*)::int as denominator,
             (percentile_cont(0.5) within group (order by extract(epoch from (first_inquiry - published_at)) / 3600)
               filter (where first_inquiry is not null))::float as median_hours
      from published`;

    const [inquiries] = await tx<{ created: number; accepted: number }[]>`
      select count(*)::int as created, count(*) filter (where i.status in ('accepted', 'closed') and i.responded_at is not null)::int as accepted
      from restix.inquiries i join restix.ticket_listings l on l.id = i.listing_id
      join restix.events e on e.id = l.event_id and not e.is_fixture
      where i.created_at >= ${from} and i.created_at < ${to}`;

    const [reports] = await tx<{ submitted: number; open: number; medianHours: number | null; resolved: number }[]>`
      select count(*) filter (where created_at >= ${from} and created_at < ${to})::int as submitted,
             count(*) filter (where status in ('open', 'in_review'))::int as open,
             (percentile_cont(0.5) within group (order by extract(epoch from (resolved_at - created_at)) / 3600)
               filter (where resolved_at >= ${from} and resolved_at < ${to}))::float as median_hours,
             count(*) filter (where resolved_at >= ${from} and resolved_at < ${to})::int as resolved
      from restix.reports`;

    const outcomes = await tx<{ party: string; outcome: string; count: number }[]>`
      select party, outcome, count(*)::int as count from restix.transaction_confirmations
      where created_at >= ${from} and created_at < ${to}
      group by party, outcome order by party, outcome`;

    const [{ both }] = await tx<{ both: number }[]>`
      select count(*)::int as both from (
        select inquiry_id from restix.transaction_confirmations
        where outcome = 'completed' and created_at < ${to}
        group by inquiry_id having count(distinct party) = 2 and max(created_at) >= ${from}
      ) x`;

    const daily = await tx<{ day: string; listings: number; inquiries: number }[]>`
      with days as (
        select generate_series(${from}::timestamptz, ${to}::timestamptz - interval '1 second', interval '1 day') as day
      )
      select to_char(d.day at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day,
             (select count(*)::int from ${real} where l.published_at >= d.day and l.published_at < d.day + interval '1 day') as listings,
             (select count(*)::int from restix.inquiries i
               join restix.ticket_listings l on l.id = i.listing_id
               join restix.events e on e.id = l.event_id and not e.is_fixture
               where i.created_at >= d.day and i.created_at < d.day + interval '1 day') as inquiries
      from days d order by d.day`;

    return {
      range,
      accounts,
      activeUsers: usage.activeUsers,
      repeatUsers: { numerator: usage.repeatUsers, denominator: usage.activeUsers },
      views,
      searches: usage.searches,
      listings,
      listingStatusNow: Object.fromEntries(statusRows.map((r) => [r.status, r.count])),
      listingsByEvent,
      listingsByFormat,
      inquiryConversion: { numerator: conversion.numerator, denominator: conversion.denominator },
      medianHoursToFirstInquiry: conversion.medianHours,
      inquiries,
      reports: {
        submitted: reports.submitted,
        open: reports.open,
        ratePer100Listings: listings.createdInRange > 0 ? (reports.submitted / listings.createdInRange) * 100 : null,
      },
      moderation: { medianHoursToResolve: reports.medianHours, resolvedInRange: reports.resolved },
      outcomes,
      bothConfirmedCompleted: both,
      daily,
    };
  });
}
