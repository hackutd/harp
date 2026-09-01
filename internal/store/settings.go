package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sync"
	"time"
)

// settingsCacheTTL bounds how stale a cached settings value may be. The form
// toggles and schemas are read on nearly every hacker-facing request but
// written a handful of times per event, so caching them removes a query from
// each one. Invalidation is in-process and Cloud Run runs several instances, so
// a super admin flipping a toggle can take up to this long to reach all of
// them -- which is why it is seconds rather than minutes.
const settingsCacheTTL = 10 * time.Second

type cachedSetting struct {
	raw     []byte
	found   bool
	expires time.Time
}

// SettingsStore handles database operations for hackathon settings
type SettingsStore struct {
	db *sql.DB

	mu    sync.RWMutex
	cache map[string]cachedSetting
}

func newSettingsStore(db *sql.DB) *SettingsStore {
	return &SettingsStore{db: db, cache: make(map[string]cachedSetting)}
}

// getCachedRaw returns the raw JSON stored under a settings key, reading
// through to the database on a miss. found is false when the key has no row at
// all; each caller applies its own default in that case, since the defaults
// genuinely differ (applications_enabled defaults closed, the RSVP toggles
// default open).
func (s *SettingsStore) getCachedRaw(ctx context.Context, key string) ([]byte, bool, error) {
	s.mu.RLock()
	entry, ok := s.cache[key]
	s.mu.RUnlock()
	if ok && time.Now().Before(entry.expires) {
		return entry.raw, entry.found, nil
	}

	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, key).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Cache the miss as well. rsvp_enabled and travel_rsvp_enabled have
			// no seed migration, so they have no row until a super admin first
			// writes one -- without this those keys would never cache at all.
			s.cacheStore(key, nil, false)
			return nil, false, nil
		}
		return nil, false, err
	}

	s.cacheStore(key, value, true)
	return value, true, nil
}

func (s *SettingsStore) cacheStore(key string, raw []byte, found bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cache == nil {
		s.cache = make(map[string]cachedSetting)
	}
	s.cache[key] = cachedSetting{raw: raw, found: found, expires: time.Now().Add(settingsCacheTTL)}
}

// invalidate drops cached keys so the next read goes back to the database. Every
// writer of a cached key must call this.
func (s *SettingsStore) invalidate(keys ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, key := range keys {
		delete(s.cache, key)
	}
}

// invalidateAll drops the whole cache. The hackathon reset writes settings
// directly through its own transaction, so it cannot invalidate key by key.
func (s *SettingsStore) invalidateAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache = make(map[string]cachedSetting)
}

// GetMany reads several settings in one round trip and primes the cache with
// them, so the typed getters that follow are served without further queries.
// Keys with no row are cached as misses, so a caller asking for five keys pays
// exactly one query whether or not they all exist.
func (s *SettingsStore) GetMany(ctx context.Context, keys ...string) (map[string]json.RawMessage, error) {
	if len(keys) == 0 {
		return map[string]json.RawMessage{}, nil
	}

	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT key, value
		FROM settings
		WHERE key = ANY($1::text[])
	`

	rows, err := s.db.QueryContext(ctx, query, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	found := make(map[string]json.RawMessage, len(keys))
	for rows.Next() {
		var key string
		var value []byte
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		found[key] = value
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, key := range keys {
		value, ok := found[key]
		s.cacheStore(key, value, ok)
	}

	return found, nil
}

const SettingsKeyApplicationSchema = "application_schema"
const SettingsKeyRSVPSchema = "rsvp_schema"
const SettingsKeyRSVPEnabled = "rsvp_enabled"
const SettingsKeyTravelRSVPSchema = "travel_rsvp_schema"
const SettingsKeyTravelRSVPEnabled = "travel_rsvp_enabled"
const SettingsKeyReviewsPerApplication = "reviews_per_application"
const SettingsKeyReviewAssignmentToggle = "review_assignment_toggle"
const SettingsKeyScanTypes = "scan_types"
const SettingsKeyScanStats = "scan_stats"
const SettingsKeyAdminScheduleEditEnabled = "admin_schedule_edit_enabled"
const SettingsKeyAdminSponsorEditEnabled = "admin_sponsor_edit_enabled"
const SettingsKeyAdminFAQEditEnabled = "admin_faq_edit_enabled"
const SettingsKeyHackathonDateRange = "hackathon_date_range"
const SettingsKeyMealGroups = "meal_groups"
const SettingsKeyApplicationsEnabled = "applications_enabled"
const SettingsKeyHackerPackURL = "hacker_pack_url"
const SettingsKeyPointsName = "points_name"
const SettingsKeyPointsEnabled = "points_enabled"
const SettingsKeyHackathonName = "hackathon_name"
const SettingsKeyContactEmail = "contact_email"
const SettingsKeyFromEmail = "from_email"
const SettingsKeyFromName = "from_name"
const SettingsKeyApplicationDueDate = "application_due_date"
const SettingsKeyPrivacyPolicyURL = "privacy_policy_url"
const SettingsKeyTermsURL = "terms_url"

type HackathonDateRange struct {
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
}

// ApplicationSchemaField defines a single field in the configurable application form.
// The full schema is stored as a JSON array in the settings table under key "application_schema".
type ApplicationSchemaField struct {
	ID           string                 `json:"id"`
	Type         string                 `json:"type"`
	Label        string                 `json:"label"`
	Required     bool                   `json:"required"`
	Section      string                 `json:"section,omitempty"`
	SectionLabel string                 `json:"section_label,omitempty"`
	SectionOrder int                    `json:"section_order"`
	DisplayOrder int                    `json:"display_order"`
	Options      []string               `json:"options,omitempty"`
	Validation   map[string]interface{} `json:"validation,omitempty"`
}

// ReviewAssignmentEntry represents a single admin's review assignment toggle state.
// Used in the review_assignment_toggle settings JSON array.
type ReviewAssignmentEntry struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
}

// GetApplicationSchema returns the parsed application form schema fields
func (s *SettingsStore) GetApplicationSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyApplicationSchema)
	if err != nil {
		return nil, err
	}
	if !found {
		return []ApplicationSchemaField{}, nil
	}

	var fields []ApplicationSchemaField
	if err := json.Unmarshal(value, &fields); err != nil {
		return nil, err
	}

	return fields, nil
}

// UpdateApplicationSchema replaces the application form schema with the provided fields
func (s *SettingsStore) UpdateApplicationSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(fields)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyApplicationSchema, string(value))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyApplicationSchema)
	return nil
}

// GetRSVPSchema returns the parsed RSVP form schema fields
func (s *SettingsStore) GetRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyRSVPSchema)
	if err != nil {
		return nil, err
	}
	if !found {
		return []ApplicationSchemaField{}, nil
	}

	var fields []ApplicationSchemaField
	if err := json.Unmarshal(value, &fields); err != nil {
		return nil, err
	}

	return fields, nil
}

// UpdateRSVPSchema replaces the RSVP form schema with the provided fields
func (s *SettingsStore) UpdateRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(fields)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyRSVPSchema, string(value))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyRSVPSchema)
	return nil
}

// GetTravelRSVPSchema returns the parsed travel RSVP form schema fields
func (s *SettingsStore) GetTravelRSVPSchema(ctx context.Context) ([]ApplicationSchemaField, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyTravelRSVPSchema)
	if err != nil {
		return nil, err
	}
	if !found {
		return []ApplicationSchemaField{}, nil
	}

	var fields []ApplicationSchemaField
	if err := json.Unmarshal(value, &fields); err != nil {
		return nil, err
	}

	return fields, nil
}

// UpdateTravelRSVPSchema replaces the travel RSVP form schema with the provided fields
func (s *SettingsStore) UpdateTravelRSVPSchema(ctx context.Context, fields []ApplicationSchemaField) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(fields)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyTravelRSVPSchema, string(value))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyTravelRSVPSchema)
	return nil
}

// GetReviewsPerApplication returns the configured number of reviews per application
func (s *SettingsStore) GetReviewsPerApplication(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyReviewsPerApplication).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 3, nil
		}
		return 0, err
	}

	var count int
	if err := json.Unmarshal(value, &count); err != nil {
		return 0, err
	}

	return count, nil
}

// SetReviewsPerApplication updates the number of reviews required per application
func (s *SettingsStore) SetReviewsPerApplication(ctx context.Context, value int) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(value)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyReviewsPerApplication, string(jsonValue))
	return err
}

// GetScanTypes returns the configured scan types
func (s *SettingsStore) GetScanTypes(ctx context.Context) ([]ScanType, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyScanTypes).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []ScanType{}, nil
		}
		return nil, err
	}

	var scanTypes []ScanType
	if err := json.Unmarshal(value, &scanTypes); err != nil {
		return nil, err
	}

	return scanTypes, nil
}

// UpdateScanTypes replaces all scan types with the provided array
func (s *SettingsStore) UpdateScanTypes(ctx context.Context, scanTypes []ScanType) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(scanTypes)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyScanTypes, value)
	return err
}

// GetScanStats returns the scan stats counter cache as a map of scan_type -> count
func (s *SettingsStore) GetScanStats(ctx context.Context) (map[string]int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `SELECT value FROM settings WHERE key = $1`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyScanStats).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]int{}, nil
		}
		return nil, err
	}

	var stats map[string]int
	if err := json.Unmarshal(value, &stats); err != nil {
		return nil, err
	}

	return stats, nil
}

// incrementScanStat atomically increments the counter for a scan type within an existing transaction.
func incrementScanStat(ctx context.Context, tx *sql.Tx, scanType string) error {
	query := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

	var value []byte
	err := tx.QueryRowContext(ctx, query, SettingsKeyScanStats).Scan(&value)
	if err != nil {
		return err
	}

	var stats map[string]int
	if err := json.Unmarshal(value, &stats); err != nil {
		return err
	}

	stats[scanType]++

	updated, err := json.Marshal(stats)
	if err != nil {
		return err
	}

	updateQuery := `UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2`
	_, err = tx.ExecContext(ctx, updateQuery, updated, SettingsKeyScanStats)
	return err
}

// resetScanStats resets the scan stats within an existing transaction.
func resetScanStats(ctx context.Context, tx *sql.Tx) error {
	query := `UPDATE settings SET value = '{}', updated_at = NOW() WHERE key = $1`
	_, err := tx.ExecContext(ctx, query, SettingsKeyScanStats)
	return err
}

// resetReviewAssignmentToggle resets review assignment toggles within an existing transaction.
func resetReviewAssignmentToggle(ctx context.Context, tx *sql.Tx) error {
	query := `UPDATE settings SET value = '[]', updated_at = NOW() WHERE key = $1`
	_, err := tx.ExecContext(ctx, query, SettingsKeyReviewAssignmentToggle)
	return err
}

// DefaultScanTypes mirrors the seeded scan_types setting (migrations 000006 and
// 000021). These two are structural — check-in gates the event and walk-in
// drives the walk-in queue — so a reset restores them rather than emptying the
// list. Meal, swag, and shop types are per-hackathon config and are dropped.
const DefaultScanTypes = `[` +
	`{"name":"check_in","display_name":"Check In","category":"check_in","is_active":true,"points":0},` +
	`{"name":"walk_in","display_name":"Walk-In","category":"walk_in","is_active":true,"points":0}` +
	`]`

// resetScanTypes restores the default scan types within an existing transaction.
func resetScanTypes(ctx context.Context, tx *sql.Tx) error {
	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2::jsonb)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
	_, err := tx.ExecContext(ctx, query, SettingsKeyScanTypes, DefaultScanTypes)
	return err
}

// resetHackathonConfig clears the per-cycle hackathon configuration within an
// existing transaction.
func resetHackathonConfig(ctx context.Context, tx *sql.Tx) error {
	// Clear only per-cycle identity and content. Organization-level settings
	// such as contact/sender addresses, application schema, review count, admin
	// permissions, and meal-group names intentionally carry forward.
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM settings WHERE key IN ($1, $2, $3, $4, $5)`,
		SettingsKeyHackathonName,
		SettingsKeyHackathonDateRange,
		SettingsKeyApplicationDueDate,
		SettingsKeyPointsName,
		SettingsKeyHackerPackURL,
	); err != nil {
		return err
	}

	if err := closeApplications(ctx, tx); err != nil {
		return err
	}

	// A fresh cycle has no point-bearing scan types yet, so keep the hacker
	// points UI hidden until an organizer deliberately configures it.
	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, 'false'::jsonb)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
	_, err := tx.ExecContext(ctx, query, SettingsKeyPointsEnabled)
	return err
}

// closeApplications puts the public form in its safe between-events state.
func closeApplications(ctx context.Context, tx *sql.Tx) error {
	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, 'false'::jsonb)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
	_, err := tx.ExecContext(ctx, query, SettingsKeyApplicationsEnabled)
	return err
}

// parseReviewAssignmentEntries tries the new object format first, then falls back to legacy []string.
func parseReviewAssignmentEntries(value []byte) ([]ReviewAssignmentEntry, error) {
	var entries []ReviewAssignmentEntry
	if err := json.Unmarshal(value, &entries); err == nil {
		return entries, nil
	}

	var ids []string
	if err := json.Unmarshal(value, &ids); err == nil {
		entries = make([]ReviewAssignmentEntry, len(ids))
		for i, id := range ids {
			entries[i] = ReviewAssignmentEntry{ID: id, Enabled: true}
		}
		return entries, nil
	}

	return nil, errors.New("unrecognized review_assignment_toggle format")
}

// GetAllReviewAssignmentToggles returns all review assignment toggle entries.
func (s *SettingsStore) GetAllReviewAssignmentToggles(ctx context.Context) ([]ReviewAssignmentEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyReviewAssignmentToggle).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []ReviewAssignmentEntry{}, nil
		}
		return nil, err
	}

	entries, err := parseReviewAssignmentEntries(value)
	if err != nil {
		return nil, err
	}

	return entries, nil
}

// GetReviewAssignmentToggle returns whether review assignment is enabled for the given super admin ID.
// The setting is stored as a JSON array of ReviewAssignmentEntry objects.
// If the setting row does not exist or the admin has no entry, defaults to true (eligible for reviews).
func (s *SettingsStore) GetReviewAssignmentToggle(ctx context.Context, superAdminID string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyReviewAssignmentToggle).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	// Treat empty/empty-object/empty-array as enabled (default)
	sv := string(value)
	if sv == "" || sv == "null" || sv == "{}" || sv == "[]" {
		return true, nil
	}

	entries, err := parseReviewAssignmentEntries(value)
	if err != nil {
		return true, nil
	}

	for _, e := range entries {
		if e.ID == superAdminID {
			return e.Enabled, nil
		}
	}

	return true, nil
}

// SetReviewAssignmentToggle updates whether review assignment is enabled for the given super admin ID.
// The setting is stored as a JSON array of super admin IDs who have enabled review assignment.
// If `enabled` is true the super admin ID will be added to the array if missing. If false it will be removed.
func (s *SettingsStore) SetReviewAssignmentToggle(ctx context.Context, superAdminID string, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// load current array (if any) with FOR UPDATE to prevent concurrent overwrites
	querySelect := `SELECT value FROM settings WHERE key = $1 FOR UPDATE`

	var value []byte
	err = tx.QueryRowContext(ctx, querySelect, SettingsKeyReviewAssignmentToggle).Scan(&value)

	var entries []ReviewAssignmentEntry

	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		entries = []ReviewAssignmentEntry{}
	} else {
		parsed, parseErr := parseReviewAssignmentEntries(value)
		if parseErr != nil {
			entries = []ReviewAssignmentEntry{}
		} else {
			entries = parsed
		}
	}

	found := false
	for i, e := range entries {
		if e.ID == superAdminID {
			found = true
			entries[i].Enabled = enabled
			break
		}
	}
	if !found {
		entries = append(entries, ReviewAssignmentEntry{ID: superAdminID, Enabled: enabled})
	}

	jsonValue, err := json.Marshal(entries)
	if err != nil {
		return err
	}

	queryUpsert := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	if _, err := tx.ExecContext(ctx, queryUpsert, SettingsKeyReviewAssignmentToggle, string(jsonValue)); err != nil {
		return err
	}

	return tx.Commit()
}

// GetAdminScheduleEditEnabled returns whether admins are allowed to edit schedule.
// Defaults to true if the setting row does not exist.
func (s *SettingsStore) GetAdminScheduleEditEnabled(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyAdminScheduleEditEnabled).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

// SetAdminScheduleEditEnabled updates whether admins are allowed to edit schedule.
func (s *SettingsStore) SetAdminScheduleEditEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyAdminScheduleEditEnabled, string(jsonValue))
	return err
}

// GetHackathonDateRange returns the configured hackathon start/end dates.
// Defaults to unconfigured (both null) if the row does not exist.
func (s *SettingsStore) GetHackathonDateRange(ctx context.Context) (HackathonDateRange, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyHackathonDateRange).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return HackathonDateRange{}, nil
		}
		return HackathonDateRange{}, err
	}

	var dateRange HackathonDateRange
	if err := json.Unmarshal(value, &dateRange); err != nil {
		return HackathonDateRange{}, err
	}

	return dateRange, nil
}

// SetHackathonDateRange updates hackathon start/end dates.
func (s *SettingsStore) SetHackathonDateRange(ctx context.Context, dateRange HackathonDateRange) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(dateRange)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyHackathonDateRange, string(jsonValue))
	return err
}

// GetHackerPackURL returns the configured Hacker Pack Notion URL.
// Defaults to an empty string if the row does not exist (not configured).
func (s *SettingsStore) GetHackerPackURL(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyHackerPackURL).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", err
	}

	var url string
	if err := json.Unmarshal(value, &url); err != nil {
		return "", err
	}

	return url, nil
}

// SetHackerPackURL updates the Hacker Pack Notion URL.
func (s *SettingsStore) SetHackerPackURL(ctx context.Context, url string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(url)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyHackerPackURL, string(jsonValue))
	return err
}

// GetPointsName returns the configured display name of the points system.
// Defaults to "Points" if the row does not exist (not configured).
func (s *SettingsStore) GetPointsName(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyPointsName).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "Points", nil
		}
		return "", err
	}

	var name string
	if err := json.Unmarshal(value, &name); err != nil {
		return "", err
	}

	return name, nil
}

// SetPointsName updates the display name of the points system.
func (s *SettingsStore) SetPointsName(ctx context.Context, name string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(name)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyPointsName, string(jsonValue))
	return err
}

// GetPointsEnabled returns whether the points system is enabled.
// Defaults to false if the setting row does not exist.
func (s *SettingsStore) GetPointsEnabled(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyPointsEnabled).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

// SetPointsEnabled updates whether the points system is enabled. When disabled
// the points system is hidden from the hacker-facing portal.
func (s *SettingsStore) SetPointsEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyPointsEnabled, string(jsonValue))
	return err
}

// GetMealGroups returns the configured list of meal group names (e.g., ["A", "B", "C", "D"])
func (s *SettingsStore) GetMealGroups(ctx context.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyMealGroups).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []string{}, nil
		}
		return nil, err
	}

	var groups []string
	if err := json.Unmarshal(value, &groups); err != nil {
		return nil, err
	}

	return groups, nil
}

// SetMealGroups updates the available meal group names
func (s *SettingsStore) SetMealGroups(ctx context.Context, groups []string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	value, err := json.Marshal(groups)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyMealGroups, value)
	return err
}

// GetMealGroupStats returns the number of hackers assigned to each meal group
func (s *SettingsStore) GetMealGroupStats(ctx context.Context) (map[string]int, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT meal_group, COUNT(*)
		FROM applications
		WHERE meal_group IS NOT NULL
		GROUP BY meal_group
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var group string
		var count int
		if err := rows.Scan(&group, &count); err != nil {
			return nil, err
		}
		stats[group] = count
	}

	return stats, rows.Err()
}

func (s *SettingsStore) GetApplicationsEnabled(ctx context.Context) (bool, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyApplicationsEnabled)
	if err != nil {
		return false, err
	}
	if !found {
		return false, nil
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

func (s *SettingsStore) SetApplicationsEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyApplicationsEnabled, string(jsonValue))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyApplicationsEnabled)
	return nil
}

// GetRSVPEnabled returns whether accepted hackers can currently submit an RSVP.
// Defaults to true so RSVPs open as soon as acceptances go out; super admins
// flip it off once the RSVP deadline passes.
func (s *SettingsStore) GetRSVPEnabled(ctx context.Context) (bool, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyRSVPEnabled)
	if err != nil {
		return false, err
	}
	if !found {
		return true, nil
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

// SetRSVPEnabled updates whether accepted hackers can currently submit an RSVP.
func (s *SettingsStore) SetRSVPEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyRSVPEnabled, string(jsonValue))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyRSVPEnabled)
	return nil
}

// GetTravelRSVPEnabled returns whether travel-approved hackers can currently
// submit their travel RSVP. Defaults to true so the form opens as soon as
// travel approvals go out; super admins flip it off once the deadline passes.
func (s *SettingsStore) GetTravelRSVPEnabled(ctx context.Context) (bool, error) {
	value, found, err := s.getCachedRaw(ctx, SettingsKeyTravelRSVPEnabled)
	if err != nil {
		return false, err
	}
	if !found {
		return true, nil
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

// SetTravelRSVPEnabled updates whether travel-approved hackers can currently submit their travel RSVP.
func (s *SettingsStore) SetTravelRSVPEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyTravelRSVPEnabled, string(jsonValue))
	if err != nil {
		return err
	}

	s.invalidate(SettingsKeyTravelRSVPEnabled)
	return nil
}

func (s *SettingsStore) GetAdminSponsorEditEnabled(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyAdminSponsorEditEnabled).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

func (s *SettingsStore) SetAdminSponsorEditEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyAdminSponsorEditEnabled, string(jsonValue))
	return err
}

func (s *SettingsStore) GetAdminFAQEditEnabled(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		SELECT value
		FROM settings
		WHERE key = $1
	`

	var value []byte
	err := s.db.QueryRowContext(ctx, query, SettingsKeyAdminFAQEditEnabled).Scan(&value)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return true, nil
		}
		return false, err
	}

	var enabled bool
	if err := json.Unmarshal(value, &enabled); err != nil {
		return false, err
	}

	return enabled, nil
}

func (s *SettingsStore) SetAdminFAQEditEnabled(ctx context.Context, enabled bool) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(enabled)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, SettingsKeyAdminFAQEditEnabled, string(jsonValue))
	return err
}

// getStringSetting returns the string value stored under key, or an empty
// string when the row does not exist or holds a JSON null.
func (s *SettingsStore) getStringSetting(ctx context.Context, key string) (string, error) {
	value, found, err := s.getCachedRaw(ctx, key)
	if err != nil {
		return "", err
	}
	if !found {
		return "", nil
	}

	var parsed *string
	if err := json.Unmarshal(value, &parsed); err != nil {
		return "", err
	}
	if parsed == nil {
		return "", nil
	}

	return *parsed, nil
}

// setStringSetting upserts a string value under key.
func (s *SettingsStore) setStringSetting(ctx context.Context, key, value string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	jsonValue, err := json.Marshal(value)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	_, err = s.db.ExecContext(ctx, query, key, string(jsonValue))
	if err != nil {
		return err
	}

	s.invalidate(key)
	return nil
}

// GetHackathonName returns the configured hackathon name (empty when unset).
func (s *SettingsStore) GetHackathonName(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyHackathonName)
}

// SetHackathonName updates the hackathon name shown across the portal and emails.
func (s *SettingsStore) SetHackathonName(ctx context.Context, name string) error {
	return s.setStringSetting(ctx, SettingsKeyHackathonName, name)
}

// GetContactEmail returns the configured public contact email (empty when unset).
func (s *SettingsStore) GetContactEmail(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyContactEmail)
}

// SetContactEmail updates the public contact email surfaced to hackers.
func (s *SettingsStore) SetContactEmail(ctx context.Context, email string) error {
	return s.setStringSetting(ctx, SettingsKeyContactEmail, email)
}

// GetFromEmail returns the configured sender email for outgoing mail.
func (s *SettingsStore) GetFromEmail(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyFromEmail)
}

// SetFromEmail updates the sender email for outgoing mail.
func (s *SettingsStore) SetFromEmail(ctx context.Context, email string) error {
	return s.setStringSetting(ctx, SettingsKeyFromEmail, email)
}

// GetFromName returns the configured sender display name for outgoing mail.
func (s *SettingsStore) GetFromName(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyFromName)
}

// SetFromName updates the sender display name for outgoing mail.
func (s *SettingsStore) SetFromName(ctx context.Context, name string) error {
	return s.setStringSetting(ctx, SettingsKeyFromName, name)
}

// GetApplicationDueDate returns the application deadline as YYYY-MM-DD.
func (s *SettingsStore) GetApplicationDueDate(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyApplicationDueDate)
}

// SetApplicationDueDate updates the application deadline (YYYY-MM-DD).
func (s *SettingsStore) SetApplicationDueDate(ctx context.Context, date string) error {
	return s.setStringSetting(ctx, SettingsKeyApplicationDueDate, date)
}

// GetPrivacyPolicyURL returns the operator's privacy policy link (empty when unset).
func (s *SettingsStore) GetPrivacyPolicyURL(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyPrivacyPolicyURL)
}

// SetPrivacyPolicyURL updates the privacy policy link shown on the login page.
func (s *SettingsStore) SetPrivacyPolicyURL(ctx context.Context, url string) error {
	return s.setStringSetting(ctx, SettingsKeyPrivacyPolicyURL, url)
}

// GetTermsURL returns the operator's terms of service link (empty when unset).
func (s *SettingsStore) GetTermsURL(ctx context.Context) (string, error) {
	return s.getStringSetting(ctx, SettingsKeyTermsURL)
}

// SetTermsURL updates the terms of service link shown on the login page.
func (s *SettingsStore) SetTermsURL(ctx context.Context, url string) error {
	return s.setStringSetting(ctx, SettingsKeyTermsURL, url)
}
