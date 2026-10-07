DELETE FROM settings WHERE key = 'directory_interest_tags';
DROP TABLE IF EXISTS directory_hidden_profiles;
DROP TABLE IF EXISTS directory_contacts;
DROP TABLE IF EXISTS pokes;
DROP TABLE IF EXISTS attendee_directory_profiles;
DROP TYPE IF EXISTS directory_intent;
