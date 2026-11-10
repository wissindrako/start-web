#!/bin/sh
# Scratch database for `prisma migrate dev` (SHADOW_DATABASE_URL)
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE \"${POSTGRES_DB}_shadow\" OWNER \"$POSTGRES_USER\";"
