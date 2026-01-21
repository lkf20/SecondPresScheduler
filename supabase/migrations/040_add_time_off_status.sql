alter table public.time_off_requests
add column if not exists status text not null default 'active';

update public.time_off_requests
set status = 'active'
where status is null;

alter table public.time_off_requests
add constraint time_off_requests_status_check
check (status in ('draft', 'active', 'deleted'));
