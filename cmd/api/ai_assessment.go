package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sort"

	"github.com/hackutd/harp/internal/store"
)

// Validate the external response during decoding so missing fields cannot turn
// into a valid-looking zero score and overwrite a previously saved assessment.
func (v *CalculateAIPercentAPIResponse) UnmarshalJSON(data []byte) error {
	var result store.AIAssessment
	if err := json.Unmarshal(data, &result); err != nil {
		return err
	}
	if result.AIScore == nil || result.Verdict == nil || result.Classes.Human == nil ||
		result.Classes.AI == nil || result.Classes.AIEdited == nil || result.Classes.Humanized == nil {
		return errors.New("AI detector response is missing required scores or verdict")
	}
	v.AIScore, v.Verdict = *result.AIScore, *result.Verdict
	v.Classes = map[string]float64{
		"human": *result.Classes.Human, "ai": *result.Classes.AI,
		"ai_edited": *result.Classes.AIEdited, "humanized": *result.Classes.Humanized,
	}
	return v.assessmentPatch().Validate()
}

func (v CalculateAIPercentAPIResponse) assessmentPatch() store.AIAssessmentPatch {
	field := func(value float64) store.AIFieldUpdate[float64] {
		return store.AIFieldUpdate[float64]{Set: true, Value: &value}
	}
	return store.AIAssessmentPatch{
		AIScore: field(v.AIScore),
		Verdict: store.AIFieldUpdate[string]{Set: true, Value: &v.Verdict},
		Classes: store.AIClassScoresPatch{
			Human: field(v.Classes["human"]), AI: field(v.Classes["ai"]),
			AIEdited: field(v.Classes["ai_edited"]), Humanized: field(v.Classes["humanized"]),
		},
	}
}

func (app *application) aiAssessmentStoreError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, store.ErrNotFound) {
		app.notFoundResponse(w, r, errors.New("application not found or not assigned to you"))
		return
	}
	app.internalServerError(w, r, err)
}

// aiDetectorError reports a failed or unusable detector call as an upstream
// failure (504 on timeout, else 502) rather than a HARP 500.
func (app *application) aiDetectorError(w http.ResponseWriter, r *http.Request, err error) {
	app.requestLogger(r).Errorw("AI detector request failed", "error", err)
	status := http.StatusBadGateway
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		status = http.StatusGatewayTimeout
	}
	writeJSONError(w, status, "AI detector request failed")
}

// Use the live form schema so automatic analysis includes every short answer,
// including questions added or renamed after the default schema was seeded.
func (app *application) shortAnswerKeys(ctx context.Context) ([]string, error) {
	fields, err := app.store.Settings.GetApplicationSchema(ctx)
	if err != nil {
		return nil, err
	}
	sort.SliceStable(fields, func(i, j int) bool { return fields[i].DisplayOrder < fields[j].DisplayOrder })
	var keys []string
	for _, field := range fields {
		if field.Section == "short_answers" {
			keys = append(keys, field.ID)
		}
	}
	return keys, nil
}
