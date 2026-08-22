#!/bin/bash
# Use this script to start a docker container for a local development database

# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux) - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop for Windows - https://docs.docker.com/docker-for-windows/install/
# 3. Open WSL - `wsl`
# 4. Run this script - `./start-database.sh`

# On Lunux and macOS you can run this script directly - `./start-database.sh`

DB_CONTAINER_NAME="apply-ai-postgres"
DB_PORT="5432"
DB_NAME="apply-ai"
DATA_DIR="/var/lib/postgresql/data"

if ! [ -x "$(command -v docker)" ]; then
  echo "Docker is not installed. Please install docker and try again."
  echo "Docker install guide: https://docs.docker.com/engine/install/"
  exit 1
fi

# import env variables from .env
set -a
source .env
set +a

DB_PASSWORD=$(echo $DATABASE_URL | awk -F':' '{print $3}' | awk -F'@' '{print $1}')

if [ "$DB_PASSWORD" = "password" ]; then
  echo "You are using the default database password"
  read -p "Should we generate a random password for you? [y/N]: " -r REPLY
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Please set a password in the .env file and try again"
    exit 1
  fi
  DB_PASSWORD=$(openssl rand -base64 12)
  # BSD sed (macOS) needs an explicit empty backup suffix, GNU sed does not
  sed -i.bak -e "s/:password@/:$DB_PASSWORD@/" .env && rm -f .env.bak
fi

# Is the host port actually forwarded? A container created by an older Docker
# Engine keeps its port bindings in config but never reapplies them on start,
# so it runs happily while nothing reaches it from the host. `docker start`
# cannot repair that - the container has to be recreated.
ports_are_published() {
  [ -n "$(docker inspect $DB_CONTAINER_NAME \
    --format "{{json (index .NetworkSettings.Ports \"$DB_PORT/tcp\")}}" 2>/dev/null \
    | grep -v '^null$')" ]
}

# The volume holding the actual database, so a recreate keeps the data
data_volume() {
  docker inspect $DB_CONTAINER_NAME \
    --format "{{range .Mounts}}{{if eq .Destination \"$DATA_DIR\"}}{{.Name}}{{end}}{{end}}" 2>/dev/null
}

create_container() {
  local volume_arg=()
  if [ -n "$1" ]; then
    volume_arg=(-v "$1:$DATA_DIR")
  fi

  docker run --name $DB_CONTAINER_NAME \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=$DB_NAME \
    "${volume_arg[@]}" \
    -d -p $DB_PORT:$DB_PORT \
    docker.io/postgres > /dev/null
}

wait_until_ready() {
  for _ in $(seq 1 30); do
    if docker exec $DB_CONTAINER_NAME pg_isready -q -U postgres 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Database did not become ready in time. Check: docker logs $DB_CONTAINER_NAME"
  return 1
}

# -a so a stopped container is found too; without it the script falls through
# to `docker run` and fails with "container name is already in use"
if [ "$(docker ps -aq -f name=^/$DB_CONTAINER_NAME$)" ]; then
  docker start $DB_CONTAINER_NAME > /dev/null

  if ports_are_published; then
    wait_until_ready || exit 1
    echo "Database container started on port $DB_PORT"
    exit 0
  fi

  VOLUME=$(data_volume)
  if [ -z "$VOLUME" ]; then
    echo "Container is not publishing port $DB_PORT and has no data volume to preserve."
    echo "Remove it manually and rerun: docker rm -f $DB_CONTAINER_NAME"
    exit 1
  fi

  echo "Container is not publishing port $DB_PORT - recreating it (data volume $VOLUME is kept)"
  docker rm -f $DB_CONTAINER_NAME > /dev/null
  create_container "$VOLUME"
  wait_until_ready || exit 1

  if ! ports_are_published; then
    echo "Port $DB_PORT still is not published. Is something else already bound to it?"
    exit 1
  fi

  echo "Database container recreated and listening on port $DB_PORT"
  exit 0
fi

create_container
wait_until_ready || exit 1
echo "Database container was successfully created on port $DB_PORT"
