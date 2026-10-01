-- Doubles players (ADR-0023, GAM-2): a teammate and a second opponent, only in doubles.
-- games.opponent stays the (first) opponent; games.my_side now means the side of the
-- frame the user stands on (left/right), the goals being at the top and bottom.

alter table games
  add column teammate  text,
  add column opponent2 text,
  add constraint games_singles_no_doubles_players
    check (format = 'doubles' or (teammate is null and opponent2 is null));
