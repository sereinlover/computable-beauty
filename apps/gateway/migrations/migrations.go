// Package migrations embeds the SQL schema files so the gateway binary can
// apply them at startup without the source tree present at runtime (see
// data.PostgresStore.Migrate, called from cmd/app.go).
package migrations

import _ "embed"

//go:embed 001_init.sql
var InitSQL string
