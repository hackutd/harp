-- Default hacker links shown as cards on the hacker home page.
-- Super admins can add, edit, or remove these at runtime.
INSERT INTO hacker_links (label, url, icon, display_order) VALUES
    ('Devpost', 'https://devpost.com', 'devpost', 0),
    ('Discord', 'https://discord.com', 'discord', 1);
