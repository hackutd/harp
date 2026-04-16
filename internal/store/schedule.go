package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"
	"time"
)

// StringArray implements sql.Scanner and driver.Valuer for PostgreSQL text[] columns.
type StringArray []string

func (a *StringArray) Scan(src any) error {
	if src == nil {
		*a = nil
		return nil
	}
	s, ok := src.(string)
	if !ok {
		if b, ok2 := src.([]byte); ok2 {
			s = string(b)
		} else {
			return fmt.Errorf("StringArray.Scan: unsupported type %T", src)
		}
	}
	s = strings.TrimSpace(s)
	if s == "{}" || s == "" {
		*a = StringArray{}
		return nil
	}
	// Strip outer braces: {item1,item2} -> item1,item2
	s = s[1 : len(s)-1]
	parts := strings.Split(s, ",")
	result := make([]string, len(parts))
	for i, p := range parts {
		// Strip surrounding quotes if present
		p = strings.TrimSpace(p)
		if len(p) >= 2 && p[0] == '"' && p[len(p)-1] == '"' {
			p = p[1 : len(p)-1]
		}
		result[i] = p
	}
	*a = result
	return nil
}

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	parts := make([]string, len(a))
	for i, s := range a {
		parts[i] = `"` + strings.ReplaceAll(s, `"`, `\"`) + `"`
	}
	return "{" + strings.Join(parts, ",") + "}", nil
}

type ScheduleItem struct {
	ID          string      `json:"id"`
	EventName   string      `json:"event_name"`
	Description string      `json:"description"`
	StartTime   time.Time   `json:"start_time"`
	EndTime     time.Time   `json:"end_time"`
	Location    string      `json:"location"`
	Tags        StringArray `json:"tags"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type ScheduleStore struct {
	db *sql.DB
}

func (s *ScheduleStore) List(ctx context.Context) ([]ScheduleItem, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT id, event_name, description, start_time, end_time, location, tags, created_at, updated_at
		FROM schedule
		ORDER BY start_time ASC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ScheduleItem
	for rows.Next() {
		var item ScheduleItem
		if err := rows.Scan(
			&item.ID, &item.EventName, &item.Description,
			&item.StartTime, &item.EndTime, &item.Location, &item.Tags,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if items == nil {
		items = []ScheduleItem{}
	}

	return items, rows.Err()
}

func (s *ScheduleStore) Create(ctx context.Context, item *ScheduleItem) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO schedule (event_name, description, start_time, end_time, location, tags)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`

	return s.db.QueryRowContext(ctx, query,
		item.EventName, item.Description, item.StartTime, item.EndTime, item.Location, item.Tags,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
}

func (s *ScheduleStore) Update(ctx context.Context, item *ScheduleItem) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		UPDATE schedule
		SET event_name = $1, description = $2, start_time = $3, end_time = $4, location = $5, tags = $6
		WHERE id = $7
		RETURNING updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		item.EventName, item.Description, item.StartTime, item.EndTime, item.Location, item.Tags, item.ID,
	).Scan(&item.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	return nil
}

func (s *ScheduleStore) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `DELETE FROM schedule WHERE id = $1`

	result, err := s.db.ExecContext(ctx, query, id)
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
