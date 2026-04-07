CREATE TABLE teams (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    code       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_teams
    BEFORE UPDATE ON teams FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE team_members (
    team_id   UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

-- Enforce one team per user at DB level
CREATE UNIQUE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
