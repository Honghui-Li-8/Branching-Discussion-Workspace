#!/usr/bin/env bash

set -u

PROJECTS=(
  "web:client/web:tsconfig.app.json"
  "server:server:tsconfig.json"
  "shared:shared:tsconfig.json"
)

total_errors=0
overall_failed=0

echo "Type check report"
echo "================="

for project in "${PROJECTS[@]}"; do
  IFS=':' read -r name dir tsconfig <<< "$project"
  config_path="$dir/$tsconfig"

  if [[ ! -f "$config_path" ]]; then
    echo "$name: skipped (missing $tsconfig)"
    continue
  fi

  output_file=$(mktemp)
  if yarn --cwd "$dir" exec tsc -p "$tsconfig" --noEmit >"$output_file" 2>&1; then
    echo "$name: clear (0 type errors)"
  else
    errors=$(grep -cE 'error TS[0-9]+:' "$output_file" || true)
    if (( errors > 0 )); then
      plural="s"
      if (( errors == 1 )); then
        plural=""
      fi
      echo "$name: $errors type error$plural"
      total_errors=$((total_errors + errors))
      overall_failed=1
    else
      echo "$name: clear (0 type errors)"
    fi
  fi
  rm -f "$output_file"
done

if (( total_errors == 0 )); then
  echo "Summary: all checked folders are clear from type errors."
else
  echo "Summary: $total_errors total type errors across checked folders."
fi

exit $overall_failed
