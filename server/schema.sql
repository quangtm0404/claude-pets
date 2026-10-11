-- Claude Pets shared leaderboard (E4-S01): one row per player who opted in.
-- Only what the board shows is kept; the API key is stored as a SHA-256 hash.
CREATE TABLE IF NOT EXISTS players (
  github_id   INTEGER PRIMARY KEY,
  login       TEXT    NOT NULL,
  key_hash    TEXT    NOT NULL UNIQUE,
  xp          INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  fav_pet     TEXT    NOT NULL DEFAULT 'cat',
  streak      INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  joined_at   INTEGER NOT NULL,
  updated_at  INTEGER,         -- null until the first score arrives
  look        TEXT    NOT NULL DEFAULT '{}',  -- E7: what the pet wears and the theme colours, for the badge and visits
  visits_off  INTEGER NOT NULL DEFAULT 0      -- E7-S02: 1 when the player turned visits off
);

CREATE INDEX IF NOT EXISTS players_by_xp ON players (xp DESC);

-- E7-S02: who visited whom, once a day per pair; `seen` once the host has been told.
CREATE TABLE IF NOT EXISTS visits (
  visitor_id INTEGER NOT NULL,
  host_id    INTEGER NOT NULL,
  day        TEXT    NOT NULL,
  seen       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_id, host_id, day)
);
