#!/bin/sh
set -eu

prepare_writable_directory() {
  directory="$1"
  mkdir -p "$directory"
  if ! chown -R node:node "$directory"; then
    echo "[ENTRYPOINT] Cannot make $directory writable for the node user. Check whether the volume is mounted read-only." >&2
    exit 1
  fi
  if ! chmod -R u+rwX "$directory"; then
    echo "[ENTRYPOINT] Cannot add owner write permission to $directory. Check the volume ACL or read-only setting." >&2
    exit 1
  fi
}

verify_node_writable() {
  path="$1"
  if ! gosu node test -w "$path"; then
    echo "[ENTRYPOINT] $path is still not writable by node after permission repair. Check Synology ACLs and volume mount options." >&2
    exit 1
  fi
}

if [ "$(id -u)" -eq 0 ]; then
  prepare_writable_directory /app/data
  prepare_writable_directory /app/logs
  verify_node_writable /app/data
  verify_node_writable /app/logs
  if [ -e /app/data/bot.db ]; then
    verify_node_writable /app/data/bot.db
  fi
  echo "[ENTRYPOINT] Volume permissions prepared; starting bot as node (UID $(id -u node))."
  exec gosu node "$@"
fi

for directory in /app/data /app/logs; do
  if [ ! -w "$directory" ]; then
    echo "[ENTRYPOINT] $directory is not writable by UID $(id -u). Fix the mounted volume ownership." >&2
    exit 1
  fi
  for path in "$directory"/*; do
    [ -e "$path" ] || continue
    if [ ! -w "$path" ]; then
      echo "[ENTRYPOINT] $path is not writable by UID $(id -u). Start the entrypoint as root so it can repair existing volume files." >&2
      exit 1
    fi
  done
done

exec "$@"
