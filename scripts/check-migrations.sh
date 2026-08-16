#!/usr/bin/env bash

set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
migrations_dir=${1:-"${script_dir}/../cmd/migrate/migrations"}

if [[ ! -d "$migrations_dir" ]]; then
  echo "ERROR: Migration directory does not exist: $migrations_dir" >&2
  exit 1
fi

find "$migrations_dir" -type f -name '*.sql' -print | awk '
function report_error(message) {
  print "ERROR: " message > "/dev/stderr"
  failed = 1
}

{
  filename = $0
  sub(/^.*\//, "", filename)
  file_count++

  if (filename !~ /^[0-9][0-9][0-9][0-9][0-9][0-9]_.+\.(up|down)\.sql$/) {
    report_error("invalid migration filename: " filename \
      " (expected 000001_description.up.sql or .down.sql)")
    next
  }

  version = substr(filename, 1, 6)
  version_number = version + 0
  if (version_number == 0) {
    report_error("migration versions must start at 000001: " filename)
    next
  }

  direction = filename ~ /\.up\.sql$/ ? "up" : "down"
  stem = filename
  sub(/\.(up|down)\.sql$/, "", stem)

  versions[version] = 1
  direction_count[version, direction]++

  if (!(version in pair_stem)) {
    pair_stem[version] = stem
  } else if (pair_stem[version] != stem) {
    report_error("version " version " is used by both " pair_stem[version] \
      " and " stem)
  }

  if (version_number > max_version) {
    max_version = version_number
  }
}

END {
  if (file_count == 0) {
    report_error("no SQL migrations found")
  }

  for (number = 1; number <= max_version; number++) {
    version = sprintf("%06d", number)
    if (!(version in versions)) {
      report_error("missing migration version " version)
    }
  }

  for (version in versions) {
    up_count = direction_count[version, "up"] + 0
    down_count = direction_count[version, "down"] + 0

    if (up_count != 1) {
      report_error("version " version " has " up_count \
        " up migrations; expected exactly 1")
    }
    if (down_count != 1) {
      report_error("version " version " has " down_count \
        " down migrations; expected exactly 1")
    }
  }

  if (failed) {
    exit 1
  }

  print "Validated " max_version " contiguous migration pairs."
}
'
