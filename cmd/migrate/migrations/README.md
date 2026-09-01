# Migrations

Raw SQL, applied with [golang-migrate]. Create one with:

```bash
task migrate-create -- add_dietary_restrictions
```

Validate numbering and pairing before you push (CI runs this too):

```bash
task migrate-check
```

[golang-migrate]: https://github.com/golang-migrate/migrate

## Naming

```
{6-digit-number}_{action}_{subject}.{up|down}.sql
```

| Action | Use for |
| --- | --- |
| `create` | Foundational schema objects — infrastructure, core tables, initial types |
| `add` | New features, tables, columns, or triggers added after initial setup |
| `alter` | Modifications to existing schema objects |
| `seed` | Initial or default data |

Keep each migration to **one concern** — one table, one type, one logical
operation. Triggers and indexes stay with their parent table. Enum types get
their own migration, separate from the table that uses them.

Every migration needs both an `.up.sql` and a `.down.sql`. Write the down
migration properly; it is the only way to unwind a bad deploy.

## Numbering

Versions are strictly contiguous from `000001`, with exactly one up and one
down file per version. `scripts/check-migrations.sh` enforces this and runs as
the first step of the `backend-audit` CI job, so a gap or a duplicate fails the
build rather than reaching a database.

This matters more than it looks. golang-migrate stores a **single integer** in
the `schema_migrations` table and only ever applies migrations *strictly
greater* than it. Numbering is therefore load-bearing, not cosmetic.

## If you are running a fork

Harp is built to be forked, and forks will want their own migrations. Read this
before adding one.

**Expect collisions.** You add `000032_add_dietary_restrictions`; upstream ships
its own `000032` next month. `task migrate-check` will catch it on the merge
with `version 000032 is used by both ...`. This is normal, and it is the reason
the check exists.

**Do not try to dodge collisions by picking a high number.** Numbering your
migrations `900001` and up looks like it keeps you clear of upstream forever.
It does the opposite: once `900001` is applied, `schema_migrations.version` is
`900001`, and every future upstream migration — `000032`, `000033`, and so on —
is below that number and gets **silently skipped**. No error, no warning, just
a database that quietly diverges from the code. It also fails `migrate-check`,
which requires contiguity from `000001`.

**When a collision happens:**

1. Renumber **your** migration above upstream's new maximum. Never renumber an
   upstream migration — you would be rewriting the identity of something other
   people have already applied.
2. Run `task migrate-check` to confirm the sequence is contiguous again.
3. If you had already applied your migration to a real database, renumbering
   changes its version. Fix `schema_migrations` by hand before running
   `migrate up` again, or golang-migrate will either re-run your migration or
   skip upstream's.

Do step 3 between events, never during one.

**Keep fork migrations few, additive, and at the tail.** New columns and new
tables merge cleanly; altering or dropping something upstream owns will hurt on
the next upgrade.

**Prefer a setting over a schema change.** Most things a school wants to vary —
the event name, dates, contact address, application questions, scan types, meal
groups, points naming — are already runtime settings in
`internal/store/settings.go`, editable from the super-admin UI with no
migration and no redeploy. Reach for a migration only when you genuinely need
new shape, not new values. If you do add something every school would want,
send it upstream so nobody has to carry a fork migration for it.
