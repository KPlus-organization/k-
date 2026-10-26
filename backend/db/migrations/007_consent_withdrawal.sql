-- A withdrawn consent blocks the account until the user accepts it again at sign-in.
-- The account and its data stay in the database.
ALTER TABLE users ADD COLUMN consent_withdrawn_at timestamptz;
