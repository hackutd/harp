package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/hackutd/harp/internal/store"
)

// Super admins edit the application and travel RSVP schemas at runtime, but a
// few field IDs and option values are read by the backend itself — travel
// opt-in decides whether an application enters travel review, and the travel
// mode answer decides whether a ticket receipt is required. This file is the
// single place those bindings are written down; the schema editors validate
// against them, and the hacker-facing handlers report them to the client so no
// literal is duplicated in the frontend.
const (
	// travelOptInFieldID is the application checkbox that puts a submitted
	// application into travel reimbursement review.
	travelOptInFieldID = "travel_reimbursement"
	// travelModeFieldID is the travel RSVP select whose value decides whether
	// receipts are required.
	travelModeFieldID = "travel_rsvp_mode"
	// travelModeFlying is the travel mode answer that requires a ticket receipt.
	travelModeFlying = "Flying"
)

// SchemaFieldContract describes one binding between the backend and a
// configurable schema field. It is served to the schema editors so they can
// flag the field and refuse edits that would break the binding.
type SchemaFieldContract struct {
	// FieldID is the response key the backend reads.
	FieldID string `json:"field_id"`
	// RequiredType is the field type the binding needs to keep working.
	RequiredType string `json:"required_type"`
	// RequiredOptions are option values that must survive on the field.
	RequiredOptions []string `json:"required_options,omitempty"`
	// Purpose names the feature that depends on the field, for editor badges.
	Purpose string `json:"purpose"`
	// InactiveWarning explains what stops working when the field is removed.
	InactiveWarning string `json:"inactive_warning"`
	// HiddenWarning explains what stops working while the field is hidden
	// from applicants.
	HiddenWarning string `json:"hidden_warning"`
}

// applicationSchemaContracts are the bindings the application schema carries.
var applicationSchemaContracts = []SchemaFieldContract{
	{
		FieldID:         travelOptInFieldID,
		RequiredType:    "checkbox",
		Purpose:         "Travel reimbursement opt-in",
		InactiveWarning: "No \"" + travelOptInFieldID + "\" checkbox in the schema: submitted applications will no longer enter travel reimbursement review.",
		HiddenWarning:   "\"" + travelOptInFieldID + "\" is hidden from applicants: new submissions will not enter travel reimbursement review.",
	},
}

// travelRSVPSchemaContracts are the bindings the travel RSVP schema carries.
var travelRSVPSchemaContracts = []SchemaFieldContract{
	{
		FieldID:         travelModeFieldID,
		RequiredType:    "select",
		RequiredOptions: []string{travelModeFlying},
		Purpose:         "Ticket receipt requirement",
		InactiveWarning: "No \"" + travelModeFieldID + "\" field in the schema: hackers will never be required to upload a ticket receipt.",
		HiddenWarning:   "\"" + travelModeFieldID + "\" is hidden from hackers: they will never be required to upload a ticket receipt.",
	},
}

// validateSchemaFields checks a schema payload before it is saved: field IDs
// must be unique, and any well-known binding the schema still declares must
// stay usable. The returned warnings describe bindings the schema no longer
// declares at all, which is allowed but disables the feature behind them.
func validateSchemaFields(contracts []SchemaFieldContract, fields []store.ApplicationSchemaField) ([]string, error) {
	seen := make(map[string]bool, len(fields))
	for _, f := range fields {
		if seen[f.ID] {
			return nil, errors.New("duplicate field ID: " + f.ID)
		}
		seen[f.ID] = true
	}

	return validateSchemaContracts(contracts, fields)
}

// validateSchemaContracts checks the well-known bindings in a schema about to
// be saved. A field that is still present but no longer usable — wrong type, or
// missing the option the backend keys off — is always a mistake, so it is
// returned as an error. A field that is gone entirely, or hidden from
// applicants, is allowed, since an event may not run travel reimbursement at
// all, but returns a warning so the editor can say the feature is now inactive.
func validateSchemaContracts(contracts []SchemaFieldContract, fields []store.ApplicationSchemaField) ([]string, error) {
	byID := make(map[string]store.ApplicationSchemaField, len(fields))
	for _, f := range fields {
		byID[f.ID] = f
	}

	warnings := []string{}
	for _, contract := range contracts {
		field, ok := byID[contract.FieldID]
		if !ok {
			warnings = append(warnings, contract.InactiveWarning)
			continue
		}
		if field.Hidden {
			warnings = append(warnings, contract.HiddenWarning)
		}

		if field.Type != contract.RequiredType {
			return nil, fmt.Errorf("field %q powers %s and must stay of type %q, got %q",
				contract.FieldID, contract.Purpose, contract.RequiredType, field.Type)
		}

		for _, required := range contract.RequiredOptions {
			if !containsOption(field.Options, required) {
				return nil, fmt.Errorf("field %q powers %s and must keep the option %q",
					contract.FieldID, contract.Purpose, required)
			}
		}
	}

	return warnings, nil
}

// schemaContractFieldID returns fieldID when the schema still defines it, and
// an empty string when the binding is inactive because the field was removed.
func schemaContractFieldID(fields []store.ApplicationSchemaField, fieldID string) string {
	for _, f := range fields {
		if f.ID == fieldID {
			return fieldID
		}
	}
	return ""
}

// conditionFieldID returns the field a show_if / required_if expression reads:
// the checkbox id itself, or the id before "=" in a "field=value" expression.
func conditionFieldID(expr string) string {
	fieldID, _, _ := strings.Cut(expr, "=")
	return fieldID
}

// dependentFieldIDs returns controllerID and every field shown or required
// only through it, following show_if / required_if chains: hiding a controller
// hides the questions that exist only because of it.
func dependentFieldIDs(fields []store.ApplicationSchemaField, controllerID string) map[string]bool {
	ids := map[string]bool{controllerID: true}
	for changed := true; changed; {
		changed = false
		for _, f := range fields {
			if ids[f.ID] {
				continue
			}
			for _, key := range []string{"show_if", "required_if"} {
				if expr, ok := f.Validation[key].(string); ok && ids[conditionFieldID(expr)] {
					ids[f.ID] = true
					changed = true
					break
				}
			}
		}
	}
	return ids
}

// travelQuestionIDs returns the travel opt-in checkbox and every field shown or
// required only through it: the questions that exist only for an applicant
// asking for travel reimbursement. They are found through the binding rather
// than the section, so renaming the section in the editor changes nothing.
func travelQuestionIDs(fields []store.ApplicationSchemaField) map[string]bool {
	if schemaContractFieldID(fields, travelOptInFieldID) == "" {
		return map[string]bool{}
	}
	return dependentFieldIDs(fields, travelOptInFieldID)
}

// hiddenFieldIDs returns every field a super admin marked hidden, plus the
// fields that are only shown or required through one of them.
func hiddenFieldIDs(fields []store.ApplicationSchemaField) map[string]bool {
	ids := map[string]bool{}
	for _, f := range fields {
		if !f.Hidden {
			continue
		}
		for id := range dependentFieldIDs(fields, f.ID) {
			ids[id] = true
		}
	}
	return ids
}

// withholdFields splits a schema into the fields applicants are shown and the
// ids kept from them. withheld is nil when nothing was removed.
func withholdFields(fields []store.ApplicationSchemaField, withheld map[string]bool) ([]store.ApplicationSchemaField, map[string]bool) {
	if len(withheld) == 0 {
		return fields, nil
	}
	visible := make([]store.ApplicationSchemaField, 0, len(fields))
	for _, f := range fields {
		if !withheld[f.ID] {
			visible = append(visible, f)
		}
	}
	return visible, withheld
}

// applicantFields returns a schema as the hacker-facing forms see it: hidden
// fields and their dependents are withheld, so they are neither shown nor
// required. Admin endpoints keep reading the full schema.
func applicantFields(fields []store.ApplicationSchemaField) ([]store.ApplicationSchemaField, map[string]bool) {
	return withholdFields(fields, hiddenFieldIDs(fields))
}

// applicantSchema returns the application schema as applicants see it, plus
// the ids of any fields withheld from them. Fields a super admin marked hidden
// are withheld, and while travel applications are closed so are the travel
// questions, so applicants are neither shown nor required to answer them and
// the opt-in binding goes inactive. Admin endpoints keep reading the full
// schema, so earlier applicants' answers still render in review.
func (app *application) applicantSchema(r *http.Request) ([]store.ApplicationSchemaField, map[string]bool, error) {
	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		return nil, nil, err
	}
	return app.withholdApplicantFields(r, schema)
}

// ownApplicationSchema returns the schema shown alongside an applicant's own
// application. A draft gets the applicant schema. A submitted application also
// keeps every withheld field it holds an answer for, so hiding a question or
// closing travel applications after the fact does not erase it from the
// applicant's view of what they submitted; withheld fields they never answered
// stay out.
func (app *application) ownApplicationSchema(r *http.Request, a *store.Application) ([]store.ApplicationSchemaField, error) {
	schema, err := app.store.Settings.GetApplicationSchema(r.Context())
	if err != nil {
		return nil, err
	}
	visible, withheld, err := app.withholdApplicantFields(r, schema)
	if err != nil {
		return nil, err
	}
	if a.Status == store.StatusDraft || len(withheld) == 0 || len(a.Responses) == 0 {
		return visible, nil
	}

	var responses map[string]json.RawMessage
	if err := json.Unmarshal(a.Responses, &responses); err != nil {
		return visible, nil
	}
	for id := range withheld {
		if v, ok := responses[id]; ok && string(v) != "null" {
			delete(withheld, id)
		}
	}
	shown, _ := withholdFields(schema, withheld)
	return shown, nil
}

// withholdApplicantFields splits a full application schema into the fields
// applicants are shown and the ids withheld from them: fields a super admin
// marked hidden and, while travel applications are closed, the travel questions.
func (app *application) withholdApplicantFields(r *http.Request, schema []store.ApplicationSchemaField) ([]store.ApplicationSchemaField, map[string]bool, error) {
	withheld := hiddenFieldIDs(schema)

	travelIDs := travelQuestionIDs(schema)
	if len(travelIDs) > 0 {
		open, err := app.store.Settings.GetTravelApplicationsEnabled(r.Context())
		if err != nil {
			return nil, nil, err
		}
		if !open {
			for id := range travelIDs {
				withheld[id] = true
			}
		}
	}

	visible, withheld := withholdFields(schema, withheld)
	return visible, withheld, nil
}

func containsOption(options []string, want string) bool {
	for _, option := range options {
		if option == want {
			return true
		}
	}
	return false
}

// SchemaContractResponse lists the bindings each editable schema carries.
type SchemaContractResponse struct {
	ApplicationSchema []SchemaFieldContract `json:"application_schema"`
	TravelRSVPSchema  []SchemaFieldContract `json:"travel_rsvp_schema"`
}

// getSchemaContract returns the schema field bindings the backend depends on
//
//	@Summary		Get schema field contracts (Super Admin)
//	@Description	Returns the field IDs and option values the backend reads out of the editable schemas, so the schema editors can flag those fields and block edits that would silently break travel reimbursement.
//	@Tags			superadmin/settings
//	@Produce		json
//	@Success		200	{object}	SchemaContractResponse
//	@Failure		401	{object}	object{error=string}
//	@Failure		403	{object}	object{error=string}
//	@Security		CookieAuth
//	@Router			/superadmin/settings/schema-contract [get]
func (app *application) getSchemaContract(w http.ResponseWriter, r *http.Request) {
	response := SchemaContractResponse{
		ApplicationSchema: applicationSchemaContracts,
		TravelRSVPSchema:  travelRSVPSchemaContracts,
	}

	if err := app.jsonResponse(w, http.StatusOK, response); err != nil {
		app.internalServerError(w, r, err)
	}
}
