alter table "business"."project"
drop constraint "project_status_check";

update "business"."project"
set "status" = case "status"
  when 'planned' then 'new'
  when 'active' then 'in_execution'
  else "status"
end
where "status" in ('planned', 'active');

alter table "business"."project"
add constraint "project_status_check" check (
  "status" in ('new', 'in_execution', 'paused', 'finalized', 'cancelled')
);

alter table "business"."requirement"
add column "paused_from_status" text;

alter table "business"."requirement"
drop constraint "requirement_status_check",
drop constraint "requirement_status_dates_check";

update "business"."requirement"
set "status" = 'finalized'
where "status" = 'closed';

alter table "business"."requirement"
add constraint "requirement_status_check" check (
  "status" in (
    'new',
    'in_analysis',
    'quoted',
    'approved',
    'in_execution',
    'finalized',
    'paused',
    'cancelled'
  )
),
add constraint "requirement_paused_from_status_check" check (
  (
    "status" = 'paused'
    and "paused_from_status" is not null
    and "paused_from_status" in (
      'new',
      'in_analysis',
      'quoted',
      'approved',
      'in_execution'
    )
  )
  or ("status" <> 'paused' and "paused_from_status" is null)
),
add constraint "requirement_status_dates_check" check (
  (
    (
      "status" in ('quoted', 'approved', 'in_execution', 'finalized')
      or (
        "status" = 'paused'
        and "paused_from_status" in ('quoted', 'approved', 'in_execution')
      )
    )
    and "quoted_on" is null
  ) is not true
  and (
    (
      "status" in ('approved', 'in_execution', 'finalized')
      or (
        "status" = 'paused'
        and "paused_from_status" in ('approved', 'in_execution')
      )
    )
    and ("approved_on" is null or "approved_by_user_id" is null)
  ) is not true
);
