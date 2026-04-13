package store

import (
	"database/sql/driver"
	"fmt"
	"strings"
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
