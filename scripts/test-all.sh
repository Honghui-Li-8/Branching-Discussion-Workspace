#!/usr/bin/env bash

set -u

TASKS=(
  "unit tests|yarn test:unit"
  "type check|yarn check:type"
  "spell check|yarn spellcheck"
)

passed=0
failed=0

echo "Test report"
echo "==========="

for task in "${TASKS[@]}"; do
  IFS='|' read -r name cmd <<< "$task"
  echo "Running $name..."

  output_file=$(mktemp)
  if bash -lc "$cmd" >"$output_file" 2>&1; then
    echo "$name: pass"
    passed=$((passed + 1))
  else
    echo "$name: fail"
    failed=$((failed + 1))
    echo "Last output for $name:"
    tail -n 40 "$output_file"
  fi

  rm -f "$output_file"
done

echo "Summary: $passed passed, $failed failed."

if (( failed > 0 )); then
  exit 1
fi
