#!/bin/bash

set -e

SCRIPT_DIR="$(realpath "$(dirname "$0")")";
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

function resolve_file() {
    local file_name="$1"
    if [ ! -f "$file_name" ]; then
        echo >&2 "$0: expected file at ${file_name}"
        return 1
    fi
    realpath "$1"
}

ENV_FILE="$(resolve_file "${PROJECT_DIR}/.env")"
ENV_FILE_B64="$(base64 < "$ENV_FILE")"

read -rp 'Proceed ([N]o/[y]es/[v]iew B64)? ' choice

case "$choice" in
    v|V|view) echo "$ENV_FILE_B64" ;;
    y|Y|yes) echo -n "$ENV_FILE_B64" | gh secret set ENV_FILE_B64 --repo uclaupe/upe-discord-bot ;;
esac
