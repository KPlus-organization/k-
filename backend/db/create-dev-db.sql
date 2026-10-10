-- Creates an empty local development database and its owner role.
-- No tables are created: the data model is not defined yet.
--
-- Run as the PostgreSQL superuser, passing the password for the new role:
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -v app_password='...' < backend/db/create-dev-db.sql
-- Then put the same password into DATABASE_URL in backend/.env:
--   postgresql://k_app:<password>@localhost:5432/k_dev

CREATE ROLE k_app LOGIN PASSWORD :'app_password';
CREATE DATABASE k_dev OWNER k_app;
