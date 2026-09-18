-- Create the Supertokens database if it does not already exist.
-- init-db.sh (run via the db container's /docker-entrypoint-initdb.d) may already
-- create it on a fresh volume, so this is made idempotent (no CREATE DATABASE
-- IF NOT EXISTS exists in Postgres; \gexec runs the generated statement only
-- when the WHERE clause matches).
SELECT 'CREATE DATABASE supertokens'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'supertokens')\gexec

-- Grant privileges to the app's admin user (keep in sync with init-db.sh).
GRANT ALL PRIVILEGES ON DATABASE supertokens TO admin;