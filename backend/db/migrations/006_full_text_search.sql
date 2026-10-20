-- Full-text vectors derived from the existing lower-cased search_text.
-- Search queries keep using strpos until the service switches over.

ALTER TABLE protection_objects
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('russian', search_text)) STORED;

ALTER TABLE materials
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('russian', search_text)) STORED;

CREATE INDEX protection_objects_search_idx ON protection_objects USING GIN (search_vector);
CREATE INDEX materials_search_idx ON materials USING GIN (search_vector);
