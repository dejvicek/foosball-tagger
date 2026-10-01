-- Five holes, direction derived (ADR-0026, TAG-1, STA-6, STA-10).
-- The pull-side and push-side lanes split into long and short; existing side-lane
-- holes cannot be split and are cleared. Direction follows from setup + hole and is
-- no longer stored.

-- Dropping the column also drops the "No shot leaves the rest blank" check that
-- names it; it is re-added below without direction.
alter table public.possessions drop column direction;
alter table public.possessions drop constraint possessions_hole_check;

update public.possessions
  set hole = case hole when 'Middle lane' then 'Middle' end
  where hole is not null;

alter table public.possessions
  add constraint possessions_hole_check
    check (hole in ('Pull long','Pull short','Middle','Push short','Push long')),
  add constraint possessions_no_shot_blank
    check (shot_type is distinct from 'No shot' or (hole is null and result is null and execution is null));
