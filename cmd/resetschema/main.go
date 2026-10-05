// Command resetschema restores the editable form schemas to the defaults HARP
// ships with, for when a super admin has edited a form into a state that is
// easier to start over from than to repair.
//
// It writes settings rows only. Applications, reviews and uploads are left
// untouched: responses stored against a field the default schema does not
// declare stay in the database, they simply stop being rendered.
//
// Usage:
//
//	DB_ADDR=... go run ./cmd/resetschema                        # application form
//	DB_ADDR=... go run ./cmd/resetschema -forms=rsvp,travel-rsvp
//	DB_ADDR=... go run ./cmd/resetschema -all -dry-run
package main

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/hackutd/harp/internal/db"
	"github.com/hackutd/harp/internal/env"
	"github.com/hackutd/harp/internal/store"
)

// formNames maps the -forms values an operator types to settings keys.
var formNames = map[string]string{
	"application": store.SettingsKeyApplicationSchema,
	"rsvp":        store.SettingsKeyRSVPSchema,
	"travel-rsvp": store.SettingsKeyTravelRSVPSchema,
}

func main() {
	forms := flag.String("forms", "application", "comma-separated forms to reset: application, rsvp, travel-rsvp")
	all := flag.Bool("all", false, "reset every form schema, ignoring -forms")
	dryRun := flag.Bool("dry-run", false, "report what would change without writing")
	assumeYes := flag.Bool("y", false, "skip the confirmation prompt")
	flag.Parse()

	keys, err := selectKeys(*forms, *all)
	if err != nil {
		log.Fatal(err)
	}

	conn, err := db.New(env.GetRequiredString("DB_ADDR"), 25, 25, "15m")
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	ctx := context.Background()
	storage := store.NewStorage(conn)

	plan, err := buildPlan(ctx, conn, storage, keys)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Print(plan)

	if *dryRun {
		fmt.Println("dry run: nothing written")
		return
	}

	if !*assumeYes && !confirm() {
		fmt.Println("aborted")
		return
	}

	for _, key := range keys {
		if err := storage.Settings.RestoreDefaultFormSchema(ctx, key); err != nil {
			log.Fatalf("failed to restore %s: %v", key, err)
		}
		fmt.Printf("restored %s\n", key)
	}

	// Running API instances cache settings in process, so a reset reaches them
	// on their next read rather than immediately. No restart is needed.
	fmt.Println("done — running servers pick this up within their settings cache TTL (10s)")
}

// selectKeys turns the -forms/-all flags into settings keys, preserving the
// order the store declares them in.
func selectKeys(forms string, all bool) ([]string, error) {
	if all {
		return store.FormSchemaKeys, nil
	}

	wanted := make(map[string]bool)
	for _, name := range strings.Split(forms, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		key, ok := formNames[name]
		if !ok {
			return nil, fmt.Errorf("unknown form %q: expected one of application, rsvp, travel-rsvp", name)
		}
		wanted[key] = true
	}

	if len(wanted) == 0 {
		return nil, fmt.Errorf("no forms selected")
	}

	keys := make([]string, 0, len(wanted))
	for _, key := range store.FormSchemaKeys {
		if wanted[key] {
			keys = append(keys, key)
		}
	}

	return keys, nil
}

// buildPlan renders what the reset would change, so the operator confirms
// against real numbers rather than the flag they typed.
func buildPlan(ctx context.Context, conn *sql.DB, storage store.Storage, keys []string) (string, error) {
	var b strings.Builder

	for _, key := range keys {
		current, err := currentFields(ctx, conn, key)
		if err != nil {
			return "", err
		}

		defaults, err := store.DefaultFormSchemaFields(key)
		if err != nil {
			return "", err
		}

		added, removed := diffFieldIDs(current, defaults)

		fmt.Fprintf(&b, "%s: %d field(s) now -> %d default field(s)\n", key, len(current), len(defaults))
		if len(removed) > 0 {
			fmt.Fprintf(&b, "  dropped: %s\n", strings.Join(removed, ", "))
		}
		if len(added) > 0 {
			fmt.Fprintf(&b, "  added:   %s\n", strings.Join(added, ", "))
		}
		if len(added) == 0 && len(removed) == 0 {
			fmt.Fprintf(&b, "  same field ids; labels, options and ordering are still rewritten\n")
		}
	}

	count, err := applicationCount(ctx, conn)
	if err != nil {
		return "", err
	}
	if count > 0 {
		fmt.Fprintf(&b, "\n%d application row(s) exist. Answers to dropped fields stay in the\n"+
			"database but disappear from the forms and from review.\n", count)
	}

	return b.String(), nil
}

// currentFields reads a schema straight from the settings table, bypassing the
// store's cache and its empty-on-missing default so a missing row is visible.
func currentFields(ctx context.Context, conn *sql.DB, key string) ([]store.ApplicationSchemaField, error) {
	var raw []byte
	err := conn.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var fields []store.ApplicationSchemaField
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("stored %s is not a field array: %w", key, err)
	}

	return fields, nil
}

func applicationCount(ctx context.Context, conn *sql.DB) (int, error) {
	var count int
	err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM applications`).Scan(&count)
	return count, err
}

// diffFieldIDs reports the field ids the default adds and the ones it drops.
func diffFieldIDs(current, defaults []store.ApplicationSchemaField) (added, removed []string) {
	currentIDs := idSet(current)
	defaultIDs := idSet(defaults)

	for id := range defaultIDs {
		if !currentIDs[id] {
			added = append(added, id)
		}
	}
	for id := range currentIDs {
		if !defaultIDs[id] {
			removed = append(removed, id)
		}
	}

	sort.Strings(added)
	sort.Strings(removed)
	return added, removed
}

func idSet(fields []store.ApplicationSchemaField) map[string]bool {
	ids := make(map[string]bool, len(fields))
	for _, f := range fields {
		ids[f.ID] = true
	}
	return ids
}

func confirm() bool {
	fmt.Print("\nOverwrite the schema(s) above with the shipped defaults? [y/N]: ")

	answer, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(answer), "y")
}
