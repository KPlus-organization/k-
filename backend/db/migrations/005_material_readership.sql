-- One accepted opening per reader/material in 30 minutes. No IP addresses or tokens.
CREATE TABLE material_readership (
  material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  reader_key text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  views bigint NOT NULL DEFAULT 1 CHECK (views > 0),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, reader_key)
);

CREATE INDEX material_readership_user_idx ON material_readership(user_id) WHERE user_id IS NOT NULL;
