package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// The embedded defaults are a second copy of what the seed migrations write, so
// they only stay correct while nobody edits one side alone. These read the
// migrations back and compare.

func TestDefaultFormSchemasParse(t *testing.T) {
	for _, key := range FormSchemaKeys {
		fields, err := DefaultFormSchemaFields(key)
		if err != nil {
			t.Fatalf("%s: %v", key, err)
		}
		if len(fields) == 0 {
			t.Fatalf("%s: default schema is empty", key)
		}

		seen := make(map[string]bool, len(fields))
		for _, f := range fields {
			if f.ID == "" || f.Type == "" || f.Label == "" {
				t.Errorf("%s: field %+v is missing id, type or label", key, f)
			}
			if seen[f.ID] {
				t.Errorf("%s: duplicate field id %q", key, f.ID)
			}
			seen[f.ID] = true
		}
	}
}

func TestDefaultFormSchemasMatchMigrations(t *testing.T) {
	tests := []struct {
		key       string
		migration string
		// patch applies the later migrations that amended the seeded schema in
		// place, so the comparison is against the current default rather than
		// the original one.
		patch func([]ApplicationSchemaField)
	}{
		{
			key:       SettingsKeyApplicationSchema,
			migration: "000006_seed_settings.up.sql",
			// 000027_alter_settings_add_hackathons_attended_max
			patch: func(fields []ApplicationSchemaField) {
				for i := range fields {
					if fields[i].ID == "hackathons_attended" {
						fields[i].Validation["max"] = float64(100)
					}
				}
			},
		},
		{key: SettingsKeyRSVPSchema, migration: "000035_seed_rsvp_schema.up.sql"},
		{key: SettingsKeyTravelRSVPSchema, migration: "000040_seed_travel_rsvp_schema.up.sql"},
	}

	for _, tt := range tests {
		t.Run(tt.key, func(t *testing.T) {
			seeded, err := seededSchema(tt.migration, tt.key)
			if err != nil {
				t.Fatal(err)
			}
			if tt.patch != nil {
				tt.patch(seeded)
			}

			embedded, err := DefaultFormSchemaFields(tt.key)
			if err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(seeded, embedded) {
				t.Errorf("internal/store/defaults/%s.json has drifted from %s.\n"+
					"Update the JSON file to match the migration (or add the amending "+
					"migration to this test's patch).", tt.key, tt.migration)
			}
		})
	}
}

// seededSchema pulls a schema out of the JSONB literal a seed migration
// inserts, undoing SQL's doubled single quotes.
func seededSchema(migration, key string) ([]ApplicationSchemaField, error) {
	path := filepath.Join("..", "..", "cmd", "migrate", "migrations", migration)
	sql, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	marker := fmt.Sprintf("VALUES ('%s', '", key)
	start := strings.Index(string(sql), marker)
	if start < 0 {
		return nil, fmt.Errorf("%s does not insert %s", migration, key)
	}
	start += len(marker)

	rest := string(sql)[start:]
	end := strings.Index(rest, "'::jsonb")
	if end < 0 {
		return nil, fmt.Errorf("%s: unterminated JSONB literal for %s", migration, key)
	}

	var fields []ApplicationSchemaField
	if err := json.Unmarshal([]byte(strings.ReplaceAll(rest[:end], "''", "'")), &fields); err != nil {
		return nil, fmt.Errorf("%s: %w", migration, err)
	}

	return fields, nil
}
