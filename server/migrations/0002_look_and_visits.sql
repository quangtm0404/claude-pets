-- 1.5.0 (E7): the badge's look and visits, for a board created before them.
ALTER TABLE players ADD COLUMN look TEXT NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN visits_off INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS visits (
  visitor_id INTEGER NOT NULL,
  host_id    INTEGER NOT NULL,
  day        TEXT    NOT NULL,
  seen       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_id, host_id, day)
);
