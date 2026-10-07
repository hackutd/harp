package store

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
)

// AIAssessment is shared by application details, lists, and review updates.
// Scores are fractions (0–1). Older applications can have only AIScore set.
type AIAssessment struct {
	AIScore *float64      `json:"ai_score" minimum:"0" maximum:"1" extensions:"x-nullable"`
	Verdict *string       `json:"verdict" enums:"human,ai,ai_edited,humanized" extensions:"x-nullable"`
	Classes AIClassScores `json:"classes"`
}

type AIClassScores struct {
	Human     *float64 `json:"human" minimum:"0" maximum:"1" extensions:"x-nullable"`
	AI        *float64 `json:"ai" minimum:"0" maximum:"1" extensions:"x-nullable"`
	AIEdited  *float64 `json:"ai_edited" minimum:"0" maximum:"1" extensions:"x-nullable"`
	Humanized *float64 `json:"humanized" minimum:"0" maximum:"1" extensions:"x-nullable"`
}

// AIFieldUpdate distinguishes an omitted field from an explicit null or zero.
type AIFieldUpdate[T any] struct {
	Set   bool
	Value *T
}

func (f *AIFieldUpdate[T]) UnmarshalJSON(data []byte) error {
	f.Set = true
	return json.Unmarshal(data, &f.Value)
}

type AIClassScoresPatch struct {
	Human     AIFieldUpdate[float64] `json:"human" swaggertype:"number" minimum:"0" maximum:"1" extensions:"x-nullable"`
	AI        AIFieldUpdate[float64] `json:"ai" swaggertype:"number" minimum:"0" maximum:"1" extensions:"x-nullable"`
	AIEdited  AIFieldUpdate[float64] `json:"ai_edited" swaggertype:"number" minimum:"0" maximum:"1" extensions:"x-nullable"`
	Humanized AIFieldUpdate[float64] `json:"humanized" swaggertype:"number" minimum:"0" maximum:"1" extensions:"x-nullable"`
}

type AIAssessmentPatch struct {
	AIScore AIFieldUpdate[float64] `json:"ai_score" swaggertype:"number" minimum:"0" maximum:"1" extensions:"x-nullable"`
	Verdict AIFieldUpdate[string]  `json:"verdict" swaggertype:"string" enums:"human,ai,ai_edited,humanized" extensions:"x-nullable"`
	Classes AIClassScoresPatch     `json:"classes"`
}

// An explicit null clears the whole class breakdown; {} changes no classes.
func (p *AIClassScoresPatch) UnmarshalJSON(data []byte) error {
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		*p = AIClassScoresPatch{
			Human:     AIFieldUpdate[float64]{Set: true},
			AI:        AIFieldUpdate[float64]{Set: true},
			AIEdited:  AIFieldUpdate[float64]{Set: true},
			Humanized: AIFieldUpdate[float64]{Set: true},
		}
		return nil
	}
	type plain AIClassScoresPatch
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	return decoder.Decode((*plain)(p))
}

func (p AIAssessmentPatch) Validate() error {
	c := p.Classes
	if !p.AIScore.Set && !p.Verdict.Set && !c.Human.Set && !c.AI.Set && !c.AIEdited.Set && !c.Humanized.Set {
		return errors.New("at least one AI assessment field is required")
	}
	for name, field := range map[string]AIFieldUpdate[float64]{
		"ai_score": p.AIScore, "classes.human": c.Human, "classes.ai": c.AI,
		"classes.ai_edited": c.AIEdited, "classes.humanized": c.Humanized,
	} {
		if field.Set && field.Value != nil && (math.IsNaN(*field.Value) || math.IsInf(*field.Value, 0) || *field.Value < 0 || *field.Value > 1) {
			return fmt.Errorf("%s must be between 0 and 1", name)
		}
	}
	if p.Verdict.Set && p.Verdict.Value != nil {
		switch *p.Verdict.Value {
		case "human", "ai", "ai_edited", "humanized":
		default:
			return errors.New("verdict must be human, ai, ai_edited, humanized, or null")
		}
	}
	return nil
}

// UpdateAIAssessment changes only supplied fields, including explicit nulls.
// ai_percent is still written so the previous release and a rollback read current scores.
// Assignment is checked in the same UPDATE so edits cannot bypass authorization.
func (s *ApplicationReviewsStore) UpdateAIAssessment(ctx context.Context, applicationID, adminID string, patch AIAssessmentPatch) (*AIAssessment, error) {
	if err := patch.Validate(); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()
	c := patch.Classes
	query := `UPDATE applications SET
		ai_score = CASE WHEN $3 THEN $4::double precision ELSE ai_score END,
		ai_percent = CASE WHEN $3 THEN round($4::double precision * 100)::smallint ELSE ai_percent END,
		ai_verdict = CASE WHEN $5 THEN $6::text ELSE ai_verdict END,
		ai_class_human = CASE WHEN $7 THEN $8::double precision ELSE ai_class_human END,
		ai_class_ai = CASE WHEN $9 THEN $10::double precision ELSE ai_class_ai END,
		ai_class_ai_edited = CASE WHEN $11 THEN $12::double precision ELSE ai_class_ai_edited END,
		ai_class_humanized = CASE WHEN $13 THEN $14::double precision ELSE ai_class_humanized END
		WHERE id = $1 AND EXISTS (
			SELECT 1 FROM application_reviews WHERE application_id = $1 AND admin_id = $2
		)
		RETURNING ai_score, ai_verdict, ai_class_human, ai_class_ai, ai_class_ai_edited, ai_class_humanized`
	var result AIAssessment
	err := s.db.QueryRowContext(ctx, query, applicationID, adminID,
		patch.AIScore.Set, patch.AIScore.Value, patch.Verdict.Set, patch.Verdict.Value,
		c.Human.Set, c.Human.Value, c.AI.Set, c.AI.Value,
		c.AIEdited.Set, c.AIEdited.Value, c.Humanized.Set, c.Humanized.Value,
	).Scan(&result.AIScore, &result.Verdict, &result.Classes.Human, &result.Classes.AI, &result.Classes.AIEdited, &result.Classes.Humanized)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CheckAssignment avoids calling the detector for applications this admin cannot edit.
func (s *ApplicationReviewsStore) CheckAssignment(ctx context.Context, applicationID, adminID string) error {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeoutDuration)
	defer cancel()
	var assigned bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS (
		SELECT 1 FROM application_reviews WHERE application_id = $1 AND admin_id = $2
	)`, applicationID, adminID).Scan(&assigned)
	if err != nil {
		return err
	}
	if !assigned {
		return ErrNotFound
	}
	return nil
}
