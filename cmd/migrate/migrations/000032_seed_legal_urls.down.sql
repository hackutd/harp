DELETE FROM settings WHERE key IN (
    'privacy_policy_url',
    'terms_url'
);
