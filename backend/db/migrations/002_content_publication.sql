-- Content is synced from the repository's content/ directory on every deploy.
-- Entries removed from content/ are unpublished instead of deleted, so that
-- users' favorites survive and come back if the entry is restored.

ALTER TABLE protection_objects ADD COLUMN is_published boolean NOT NULL DEFAULT true;
ALTER TABLE materials ADD COLUMN is_published boolean NOT NULL DEFAULT true;

-- DOCX files are now served by the backend from content/files/:
-- file_path is the file name there, file_name is the name offered for download.
ALTER TABLE materials RENAME COLUMN download_path TO file_path;
ALTER TABLE materials RENAME COLUMN source_file TO file_name;
UPDATE materials SET file_path = regexp_replace(file_path, '^.*/', '') WHERE file_path IS NOT NULL;
