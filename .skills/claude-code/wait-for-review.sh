#!/usr/bin/env bash
set -u

SESSION_DIR="${1:-}"
ROUND_ID="${2:-}"
WAIT_FOR="${3:-review}"
TIMEOUT_SEC="${4:-1800}"

emit_json() {
    local status="$1"
    local reason="$2"
    local path="$3"
    local elapsed="$4"
    local escaped_path="${path//\\/\\\\}"
    escaped_path="${escaped_path//\"/\\\"}"

    if [ -n "$reason" ]; then
        printf '{"status":"%s","reason":"%s","wait_for":"%s","round":"%s","path":"%s","elapsed_sec":%s}\n' \
            "$status" "$reason" "$WAIT_FOR" "$ROUND_ID" "$escaped_path" "$elapsed"
    else
        printf '{"status":"%s","wait_for":"%s","round":"%s","path":"%s","elapsed_sec":%s}\n' \
            "$status" "$WAIT_FOR" "$ROUND_ID" "$escaped_path" "$elapsed"
    fi
}

if [ -z "$SESSION_DIR" ] || [ ! -d "$SESSION_DIR" ]; then
    emit_json "error" "session_dir_missing" "$SESSION_DIR" 0
    exit 1
fi

if [[ ! "$ROUND_ID" =~ ^R[0-9]+$ ]]; then
    emit_json "error" "bad_round_id" "" 0
    exit 1
fi

if [[ ! "$TIMEOUT_SEC" =~ ^[0-9]+$ ]]; then
    emit_json "error" "bad_timeout" "" 0
    exit 1
fi

case "$WAIT_FOR" in
    review)
        TARGET="$SESSION_DIR/$ROUND_ID-03-codex-review.md"
        ;;
    next)
        ROUND_NUMBER="${ROUND_ID#R}"
        NEXT_ROUND="R$((ROUND_NUMBER + 1))"
        TARGET="$SESSION_DIR/$NEXT_ROUND-01-round-start.md"
        ;;
    final)
        TARGET="$SESSION_DIR/final.md"
        ;;
    *)
        emit_json "error" "bad_wait_for" "" 0
        exit 1
        ;;
esac

START_SECONDS=$SECONDS

while (( SECONDS - START_SECONDS < TIMEOUT_SEC )); do
    if [ -f "$TARGET" ]; then
        emit_json "ready" "" "$TARGET" "$((SECONDS - START_SECONDS))"
        exit 0
    fi

    ELAPSED="$((SECONDS - START_SECONDS))"
    if (( ELAPSED < 30 )); then
        sleep 2
    elif (( ELAPSED < 90 )); then
        sleep 5
    else
        sleep 10
    fi
done

emit_json "timeout" "" "$TARGET" "$((SECONDS - START_SECONDS))"
exit 2
