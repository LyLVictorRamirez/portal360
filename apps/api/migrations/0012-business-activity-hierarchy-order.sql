drop trigger if exists "activity_enforce_hierarchy_and_stage" on "business"."activity";

drop function if exists "business"."enforce_activity_hierarchy_and_stage"();

create function "business"."enforce_activity_hierarchy_and_stage"()
returns trigger
language plpgsql
as $$
declare
  parent_activity "business"."activity"%rowtype;
  ancestor_activity_id uuid;
  hierarchy_depth integer := 1;
  subtree_depth integer := 1;
begin
  if new."project_stage_id" is not null and not exists (
    select 1
    from "business"."project_stage" as project_stage
    where project_stage."id" = new."project_stage_id"
      and project_stage."project_id" = new."project_id"
  ) then
    raise exception 'The activity stage must belong to its project.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old."project_id" is distinct from new."project_id"
      or old."requirement_id" is distinct from new."requirement_id"
      or old."ticket_id" is distinct from new."ticket_id" then
      raise exception 'Activity containers are immutable.' using errcode = '23514';
    end if;

    if old."project_stage_id" is distinct from new."project_stage_id" and exists (
      select 1
      from "business"."activity" as child_activity
      where child_activity."parent_activity_id" = old."id"
    ) then
      raise exception 'Activities with descendants cannot change stage.' using errcode = '23514';
    end if;
  end if;

  if new."parent_activity_id" is null then
    return new;
  end if;

  if new."parent_activity_id" = new."id" then
    raise exception 'An activity cannot be its own parent.' using errcode = '23514';
  end if;

  select *
  into parent_activity
  from "business"."activity"
  where "id" = new."parent_activity_id";

  if parent_activity."id" is null then
    raise exception 'The activity parent does not exist.' using errcode = '23514';
  end if;

  if parent_activity."project_id" is distinct from new."project_id"
    or parent_activity."requirement_id" is distinct from new."requirement_id"
    or parent_activity."ticket_id" is distinct from new."ticket_id"
    or parent_activity."project_stage_id" is distinct from new."project_stage_id" then
    raise exception 'Child activities must share their parent container and stage.'
      using errcode = '23514';
  end if;

  ancestor_activity_id := parent_activity."id";

  while ancestor_activity_id is not null loop
    if ancestor_activity_id = new."id" then
      raise exception 'An activity cannot be assigned to one of its descendants.'
        using errcode = '23514';
    end if;

    hierarchy_depth := hierarchy_depth + 1;

    if hierarchy_depth > 4 then
      raise exception 'Activity hierarchies support at most four levels.' using errcode = '23514';
    end if;

    select activity."parent_activity_id"
    into ancestor_activity_id
    from "business"."activity" as activity
    where activity."id" = ancestor_activity_id;
  end loop;

  with recursive descendants("activity_id", "depth") as (
    select new."id", 1
    union all
    select child_activity."id", descendants."depth" + 1
    from "business"."activity" as child_activity
    inner join descendants on descendants."activity_id" = child_activity."parent_activity_id"
  )
  select coalesce(max(descendants."depth"), 1)
  into subtree_depth
  from descendants;

  if hierarchy_depth + subtree_depth - 1 > 4 then
    raise exception 'Activity hierarchies support at most four levels.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "activity_enforce_hierarchy_and_stage"
before insert or update on "business"."activity"
for each row execute function "business"."enforce_activity_hierarchy_and_stage"();
