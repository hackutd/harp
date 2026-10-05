package main

import (
	"errors"
	"fmt"
	"net/http"

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
}

// applicationSchemaContracts are the bindings the application schema carries.
var applicationSchemaContracts = []SchemaFieldContract{
	{
		FieldID:         travelOptInFieldID,
		RequiredType:    "checkbox",
		Purpose:         "Travel reimbursement opt-in",
		InactiveWarning: "No \"" + travelOptInFieldID + "\" checkbox in the schema: submitted applications will no longer enter travel reimbursement review.",
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
// returned as an error. A field that is gone entirely is allowed, since an
// event may not run travel reimbursement at all, but returns a warning so the
// editor can say the feature is now inactive.
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
