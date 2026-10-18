-- General checklists cover several objects and do not belong to a single topic.
ALTER TABLE materials ALTER COLUMN topic DROP NOT NULL;

CREATE TABLE saved_documents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  template_id text NOT NULL,
  template_version integer NOT NULL,
  -- A trusted snapshot preserves the text of a saved document when templates change.
  template jsonb NOT NULL,
  fields jsonb NOT NULL,
  complete boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_documents_user_updated_idx ON saved_documents(user_id, updated_at DESC);
