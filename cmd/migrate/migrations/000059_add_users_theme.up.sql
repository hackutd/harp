-- The portal colour scheme each user picked. Dark is the default for every
-- role; light is the admin palette.
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark'
    CONSTRAINT users_theme_check CHECK (theme IN ('light', 'dark'));
