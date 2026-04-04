#!/usr/bin/env bash

set -u

TASKS=(
  "unit tests|yarn test:unit|required"
  "ownership import boundary|yarn check:ownership-boundary|required"
  "type check|yarn check:type|required"
  "deprecation check|yarn check:deprecations|optional"
  "spell check|yarn spellcheck|optional"
)

passed=0
failed=0
warnings=0

echo "Test report"
echo "==========="

for task in "${TASKS[@]}"; do
  IFS='|' read -r name cmd mode <<< "$task"
  echo "Running $name..."

  output_file=$(mktemp)
  if bash -lc "$cmd" >"$output_file" 2>&1; then
    echo "$name: pass"
    passed=$((passed + 1))
  else
    if [[ "$mode" == "optional" ]]; then
      echo "$name: warning"
      warnings=$((warnings + 1))
      echo "Last output for $name:"
      tail -n 40 "$output_file"
      echo "::warning::$name failed, but is non-blocking."
    else
      echo "$name: fail"
      failed=$((failed + 1))
      echo "Last output for $name:"
      tail -n 40 "$output_file"
    fi
  fi

  rm -f "$output_file"
done

echo "Summary: $passed passed, $warnings warnings, $failed failed."

if (( failed > 0 )); then
  exit 1
fi
