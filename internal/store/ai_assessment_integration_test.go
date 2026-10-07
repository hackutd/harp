package store

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func assessmentPatch(t *testing.T, body string) AIAssessmentPatch {
	t.Helper()
	var patch AIAssessmentPatch
	require.NoError(t, json.Unmarshal([]byte(body), &patch))
	return patch
}

func TestIntegrationAIAssessment(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	seedIntegration(t, db)
	ctx := context.Background()
	s := &ApplicationReviewsStore{db: db}
	apps := &ApplicationsStore{db: db}
	const appID = "aaaaaaaa-0000-0000-0000-000000000002"
	const adminID = "44444444-4444-4444-4444-444444444444"
	require.NoError(t, s.CheckAssignment(ctx, appID, adminID))
	before, err := apps.GetByID(ctx, appID)
	require.NoError(t, err)
	require.Nil(t, before.AIScore)
	require.Nil(t, before.Verdict)
	require.Nil(t, before.Classes.Human)

	full := assessmentPatch(t, `{"ai_score":0.5956428647041321,"verdict":"ai","classes":{"human":0.4043571352958679,"ai":0.5150407552719116,"ai_edited":0.010439506731927395,"humanized":0.07016260176897049}}`)
	saved, err := s.UpdateAIAssessment(ctx, appID, adminID, full)
	require.NoError(t, err)
	require.Equal(t, 0.5956428647041321, *saved.AIScore)
	// The previous release still reads ai_percent, so it must follow ai_score.
	var aiPercent *int
	require.NoError(t, db.QueryRowContext(ctx, `SELECT ai_percent FROM applications WHERE id = $1`, appID).Scan(&aiPercent))
	require.Equal(t, 60, *aiPercent)

	// Updating one class leaves the overall score, verdict and other classes intact.
	updated, err := s.UpdateAIAssessment(ctx, appID, adminID, assessmentPatch(t, `{"classes":{"human":0}}`))
	require.NoError(t, err)
	require.Equal(t, 0.0, *updated.Classes.Human)
	require.Equal(t, saved.AIScore, updated.AIScore)
	require.Equal(t, saved.Verdict, updated.Verdict)
	require.Equal(t, saved.Classes.AI, updated.Classes.AI)
	require.Equal(t, saved.Classes.AIEdited, updated.Classes.AIEdited)
	require.Equal(t, saved.Classes.Humanized, updated.Classes.Humanized)

	detail, err := apps.GetByID(ctx, appID)
	require.NoError(t, err)
	require.Equal(t, *updated, detail.AIAssessment)
	listed, err := apps.List(ctx, ApplicationListFilters{}, nil, DirectionForward, 50)
	require.NoError(t, err)
	found := false
	for _, item := range listed.Applications {
		if item.ID == appID {
			found = true
			require.Equal(t, *updated, item.AIAssessment)
		}
	}
	require.True(t, found)

	// Another user cannot change even a single field.
	const unassigned = "11111111-1111-1111-1111-111111111111"
	require.ErrorIs(t, s.CheckAssignment(ctx, appID, unassigned), ErrNotFound)
	_, err = s.UpdateAIAssessment(ctx, appID, unassigned, assessmentPatch(t, `{"ai_score":0}`))
	require.ErrorIs(t, err, ErrNotFound)
	detail, err = apps.GetByID(ctx, appID)
	require.NoError(t, err)
	require.Equal(t, *updated, detail.AIAssessment)

	// Null clears individual values, including a class, without clearing its peers.
	cleared, err := s.UpdateAIAssessment(ctx, appID, adminID, assessmentPatch(t, `{"verdict":null,"classes":{"ai_edited":null}}`))
	require.NoError(t, err)
	require.Nil(t, cleared.Verdict)
	require.Nil(t, cleared.Classes.AIEdited)
	require.Equal(t, saved.Classes.AI, cleared.Classes.AI)

	cleared, err = s.UpdateAIAssessment(ctx, appID, adminID, assessmentPatch(t, `{"ai_score":0,"classes":null}`))
	require.NoError(t, err)
	require.Equal(t, 0.0, *cleared.AIScore)
	require.Equal(t, AIClassScores{}, cleared.Classes)
	cleared, err = s.UpdateAIAssessment(ctx, appID, adminID, assessmentPatch(t, `{"ai_score":null}`))
	require.NoError(t, err)
	require.Nil(t, cleared.AIScore)
	require.NoError(t, db.QueryRowContext(ctx, `SELECT ai_percent FROM applications WHERE id = $1`, appID).Scan(&aiPercent))
	require.Nil(t, aiPercent)

	// Both API-independent store calls and direct SQL reject invalid scores.
	_, err = s.UpdateAIAssessment(ctx, appID, adminID, assessmentPatch(t, `{"ai_score":2}`))
	require.Error(t, err)
	_, err = db.ExecContext(ctx, `UPDATE applications SET ai_score = 2 WHERE id = $1`, appID)
	require.Error(t, err)
}

func TestIntegrationAIAssessmentMigration(t *testing.T) {
	db := integrationDB(t)
	defer db.Close()
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	require.NoError(t, err)
	defer conn.Close()
	// A connection-local table shadows the real one, keeping this migration test isolated.
	_, err = conn.ExecContext(ctx, `CREATE TEMP TABLE applications (
		id integer PRIMARY KEY, ai_percent smallint,
		CONSTRAINT applications_ai_percent_check CHECK (ai_percent BETWEEN 0 AND 100)
	);
	INSERT INTO applications VALUES (1, NULL), (2, 0), (3, 1), (4, 60), (5, 100);`)
	require.NoError(t, err)
	up, err := os.ReadFile("../../cmd/migrate/migrations/000055_alter_applications_ai_assessment.up.sql")
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, string(up))
	require.NoError(t, err)
	var migrated int
	err = conn.QueryRowContext(ctx, `SELECT count(*) FROM applications WHERE
		((id = 1 AND ai_score IS NULL) OR (id = 2 AND ai_score = 0) OR
		 (id = 3 AND ai_score = 0.01) OR (id = 4 AND ai_score = 0.6) OR (id = 5 AND ai_score = 1))
		AND ai_verdict IS NULL AND ai_class_human IS NULL AND ai_class_ai IS NULL
		AND ai_class_ai_edited IS NULL AND ai_class_humanized IS NULL`).Scan(&migrated)
	require.NoError(t, err)
	require.Equal(t, 5, migrated)
	err = conn.QueryRowContext(ctx, `SELECT count(*) FROM applications WHERE
		(id = 1 AND ai_percent IS NULL) OR (id = 2 AND ai_percent = 0) OR
		(id = 3 AND ai_percent = 1) OR (id = 4 AND ai_percent = 60) OR (id = 5 AND ai_percent = 100)`).Scan(&migrated)
	require.NoError(t, err)
	require.Equal(t, 5, migrated, "expand-only migration must keep ai_percent for the previous release")
	down, err := os.ReadFile("../../cmd/migrate/migrations/000055_alter_applications_ai_assessment.down.sql")
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, string(down))
	require.NoError(t, err)
	err = conn.QueryRowContext(ctx, `SELECT count(*) FROM applications WHERE
		(id = 1 AND ai_percent IS NULL) OR (id = 2 AND ai_percent = 0) OR
		(id = 3 AND ai_percent = 1) OR (id = 4 AND ai_percent = 60) OR (id = 5 AND ai_percent = 100)`).Scan(&migrated)
	require.NoError(t, err)
	require.Equal(t, 5, migrated)
}
