-- Shot direction: Straight or Z/7 (ADR-0028). Existing shots are assumed Straight;
-- No shot possessions stay blank, like every other shot field.

alter table public.possessions
  add column shot_direction text check (shot_direction in ('Straight','Z/7'));

update public.possessions set shot_direction = 'Straight' where shot_type is distinct from 'No shot';

alter table public.possessions drop constraint possessions_no_shot_blank;
alter table public.possessions
  add constraint possessions_no_shot_blank
    check (shot_type is distinct from 'No shot'
           or (hole is null and shot_direction is null and result is null and execution is null));
