package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"math/big"
	"strings"
	"time"
)

var (
	ErrTeamFull      = errors.New("team is full")
	ErrAlreadyInTeam = errors.New("user is already in a team")
)

const MaxTeamSize = 4

type Team struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Code      string       `json:"code"`
	Members   []TeamMember `json:"members,omitempty"`
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type TeamMember struct {
	UserID            string    `json:"user_id"`
	Email             string    `json:"email"`
	ProfilePictureURL *string   `json:"profile_picture_url,omitempty"`
	JoinedAt          time.Time `json:"joined_at"`
}

type TeamsStore struct {
	db *sql.DB
}

const codeCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const codeLength = 6

func generateTeamCode() (string, error) {
	var sb strings.Builder
	for range codeLength {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(codeCharset))))
		if err != nil {
			return "", err
		}
		sb.WriteByte(codeCharset[idx.Int64()])
	}
	return sb.String(), nil
}

func (s *TeamsStore) Create(ctx context.Context, team *Team, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Check user not already in a team
	var exists bool
	err = tx.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM team_members WHERE user_id = $1)`, userID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return ErrAlreadyInTeam
	}

	// Generate unique code with retry
	var code string
	for range 5 {
		code, err = generateTeamCode()
		if err != nil {
			return err
		}
		err = tx.QueryRowContext(ctx,
			`INSERT INTO teams (name, code) VALUES ($1, $2)
			 RETURNING id, created_at, updated_at`,
			team.Name, code,
		).Scan(&team.ID, &team.CreatedAt, &team.UpdatedAt)
		if err != nil {
			if strings.Contains(err.Error(), "teams_code_key") {
				continue
			}
			return err
		}
		break
	}
	if err != nil {
		return err
	}
	team.Code = code

	// Add creator as member
	_, err = tx.ExecContext(ctx,
		`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
		team.ID, userID,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *TeamsStore) GetByID(ctx context.Context, id string) (*Team, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var team Team
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, code, created_at, updated_at FROM teams WHERE id = $1`,
		id,
	).Scan(&team.ID, &team.Name, &team.Code, &team.CreatedAt, &team.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &team, nil
}

func (s *TeamsStore) GetByUserID(ctx context.Context, userID string) (*Team, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var team Team
	err := s.db.QueryRowContext(ctx,
		`SELECT t.id, t.name, t.code, t.created_at, t.updated_at
		 FROM teams t
		 JOIN team_members tm ON t.id = tm.team_id
		 WHERE tm.user_id = $1`,
		userID,
	).Scan(&team.ID, &team.Name, &team.Code, &team.CreatedAt, &team.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &team, nil
}

func (s *TeamsStore) GetByCode(ctx context.Context, code string) (*Team, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	var team Team
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, code, created_at, updated_at FROM teams WHERE code = $1`,
		code,
	).Scan(&team.ID, &team.Name, &team.Code, &team.CreatedAt, &team.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &team, nil
}

func (s *TeamsStore) AddMember(ctx context.Context, teamID string, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Check user not already in any team
	var alreadyInTeam bool
	err = tx.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM team_members WHERE user_id = $1)`, userID,
	).Scan(&alreadyInTeam)
	if err != nil {
		return err
	}
	if alreadyInTeam {
		return ErrAlreadyInTeam
	}

	// Check team size
	var count int
	err = tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM team_members WHERE team_id = $1`, teamID,
	).Scan(&count)
	if err != nil {
		return err
	}
	if count >= MaxTeamSize {
		return ErrTeamFull
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`,
		teamID, userID,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *TeamsStore) RemoveMember(ctx context.Context, teamID string, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx,
		`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
		teamID, userID,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}

	// Check if team is now empty -> auto-delete
	var remaining int
	err = tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM team_members WHERE team_id = $1`, teamID,
	).Scan(&remaining)
	if err != nil {
		return err
	}
	if remaining == 0 {
		_, err = tx.ExecContext(ctx, `DELETE FROM teams WHERE id = $1`, teamID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *TeamsStore) GetMembers(ctx context.Context, teamID string) ([]TeamMember, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT tm.user_id, u.email, u.profile_picture_url, tm.joined_at
		FROM team_members tm
		JOIN users u ON tm.user_id = u.id
		WHERE tm.team_id = $1
		ORDER BY tm.joined_at ASC
	`
	rows, err := s.db.QueryContext(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []TeamMember
	for rows.Next() {
		var m TeamMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.ProfilePictureURL, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []TeamMember{}
	}
	return members, rows.Err()
}

func (s *TeamsStore) Update(ctx context.Context, team *Team) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	err := s.db.QueryRowContext(ctx,
		`UPDATE teams SET name = $1 WHERE id = $2 RETURNING updated_at`,
		team.Name, team.ID,
	).Scan(&team.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *TeamsStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	result, err := s.db.ExecContext(ctx, `DELETE FROM teams WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
