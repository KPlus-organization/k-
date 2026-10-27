-- Link to the legal act of a fee schedule in the free ConsultantPlus (content/fees: «ссылка_на_основание»).
-- Links to individual items are stored with the fees themselves.
ALTER TABLE fee_schedules ADD COLUMN basis_url text;
