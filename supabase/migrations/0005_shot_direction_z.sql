-- Shot direction Z/7 renamed Z (ADR-0030).

alter table public.possessions drop constraint possessions_shot_direction_check;
update public.possessions set shot_direction = 'Z' where shot_direction = 'Z/7';
alter table public.possessions
  add constraint possessions_shot_direction_check check (shot_direction in ('Straight','Z'));
