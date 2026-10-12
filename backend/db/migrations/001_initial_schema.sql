-- Initial schema: users and JWT refresh tokens, content (protection objects and
-- materials), per-user favorites and navigation history.

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login            text NOT NULL,
  -- Lower-cased copies used for case-insensitive uniqueness and lookup.
  login_key        text NOT NULL UNIQUE,
  email            text NOT NULL,
  email_key        text NOT NULL UNIQUE,
  name             text NOT NULL,
  password_hash    text NOT NULL,
  consent_given_at timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 hash of each refresh token is stored.
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);

CREATE TABLE protection_objects (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL,
  sort_order  integer NOT NULL,
  -- Lower-cased title and description for substring search.
  search_text text NOT NULL
);

CREATE TABLE materials (
  id            text PRIMARY KEY,
  topic         text NOT NULL REFERENCES protection_objects (id),
  kind          text NOT NULL CHECK (kind IN ('article', 'checklist', 'reference')),
  title         text NOT NULL,
  page_title    text NOT NULL,
  description   text NOT NULL,
  source_file   text,
  download_path text,
  -- Structured content blocks; see docs/api.md, "Material".
  intro         jsonb NOT NULL DEFAULT '[]',
  sections      jsonb NOT NULL DEFAULT '[]',
  has_content   boolean NOT NULL,
  sort_order    integer NOT NULL,
  -- Lower-cased full text for substring search.
  search_text   text NOT NULL
);
CREATE INDEX materials_topic_idx ON materials (topic);

CREATE TABLE material_relations (
  material_id text NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  related_id  text NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  PRIMARY KEY (material_id, related_id)
);

CREATE TABLE favorites (
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  material_id text NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, material_id)
);

CREATE TABLE history_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('material', 'search', 'tool')),
  target     text NOT NULL,
  title      text NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_entries_user_visited_idx ON history_entries (user_id, visited_at DESC);
