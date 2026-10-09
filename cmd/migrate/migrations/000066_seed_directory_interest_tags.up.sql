INSERT INTO settings (key, value) VALUES ('directory_interest_tags', '[
    "AI/ML", "Web Dev", "Mobile", "Hardware", "Cybersecurity", "Data Science",
    "Game Dev", "Design", "FinTech", "HealthTech", "Sustainability", "EdTech",
    "Blockchain", "Robotics", "AR/VR", "Social Good"
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
