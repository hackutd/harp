package store

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
)

// defaultSchemaFS holds the shipped form schemas as they are seeded by
// migrations 000006 (application, plus the hackathons_attended bound added by
// 000027), 000035 (RSVP) and 000040 (travel RSVP). They are duplicated here
// because a migration only ever runs once: restoring a schema a super admin has
// since edited needs the default available at runtime. TestDefaultSchemasMatch
// Migrations guards the copy against drift.
//
//go:embed defaults/*.json
var defaultSchemaFS embed.FS

// defaultSchemaFiles maps each editable form schema setting to its default.
var defaultSchemaFiles = map[string]string{
	SettingsKeyApplicationSchema: "defaults/application_schema.json",
	SettingsKeyRSVPSchema:        "defaults/rsvp_schema.json",
	SettingsKeyTravelRSVPSchema:  "defaults/travel_rsvp_schema.json",
}

// FormSchemaKeys lists the settings keys that hold an editable form schema, in
// the order an operator thinks about them.
var FormSchemaKeys = []string{
	SettingsKeyApplicationSchema,
	SettingsKeyRSVPSchema,
	SettingsKeyTravelRSVPSchema,
}

// DefaultFormSchema returns the shipped JSON for a form schema setting.
func DefaultFormSchema(key string) (json.RawMessage, error) {
	name, ok := defaultSchemaFiles[key]
	if !ok {
		return nil, fmt.Errorf("no default schema for settings key %q", key)
	}

	raw, err := defaultSchemaFS.ReadFile(name)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(raw), nil
}

// DefaultFormSchemaFields returns the shipped fields for a form schema setting.
func DefaultFormSchemaFields(key string) ([]ApplicationSchemaField, error) {
	raw, err := DefaultFormSchema(key)
	if err != nil {
		return nil, err
	}

	var fields []ApplicationSchemaField
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("parsing default %s: %w", key, err)
	}

	return fields, nil
}

// RestoreDefaultFormSchema replaces a form schema setting with the shipped
// default. Responses already stored against removed field ids are left in
// place: they stay in the applications table, simply unreferenced by the form.
func (s *SettingsStore) RestoreDefaultFormSchema(ctx context.Context, key string) error {
	raw, err := DefaultFormSchema(key)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()

	query := `
		INSERT INTO settings (key, value)
		VALUES ($1, $2::jsonb)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`

	if _, err := s.db.ExecContext(ctx, query, key, string(raw)); err != nil {
		return err
	}

	s.invalidate(key)
	return nil
}
