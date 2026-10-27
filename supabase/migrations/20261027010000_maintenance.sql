-- Housekeeping that keeps the privacy policy's retention promises true.
-- Called daily by /api/cron/maintenance (Vercel Cron) or by pg_cron on Supabase.

create or replace function restix.purge_old_data() returns jsonb
language plpgsql security definer set search_path = restix, pg_temp as $$
declare
  v_analytics integer;
  v_limits integer;
  v_expired integer;
begin
  -- Analytics events are kept for 18 months.
  delete from restix.analytics_events where occurred_at < now() - interval '18 months';
  get diagnostics v_analytics = row_count;
  -- Rate-limit windows are only needed while they are open.
  delete from restix.rate_limits where window_start < now() - interval '2 days';
  get diagnostics v_limits = row_count;
  v_expired := restix.expire_listings();
  return jsonb_build_object('analytics_deleted', v_analytics, 'rate_limits_deleted', v_limits, 'listings_expired', v_expired);
end $$;

revoke all on function restix.purge_old_data() from public;
