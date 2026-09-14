-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('STEAM_PROFILE');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "steam_id64" VARCHAR(17) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steam_profile_snapshots" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "persona_name" TEXT NOT NULL,
    "profile_url" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL,
    "visibility" "ProfileVisibility" NOT NULL,
    "country_code" VARCHAR(8),
    "account_created_at" TIMESTAMPTZ(3),
    "cs2_playtime_visible" BOOLEAN NOT NULL,
    "cs2_total_hours" DOUBLE PRECISION,
    "cs2_last_two_weeks_hours" DOUBLE PRECISION,
    "vac_banned" BOOLEAN,
    "vac_ban_count" INTEGER,
    "game_ban_count" INTEGER,
    "community_banned" BOOLEAN,
    "economy_ban" VARCHAR(32),
    "days_since_last_ban" INTEGER,
    "data_version" INTEGER NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steam_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL,
    "error_code" VARCHAR(64),
    "error_message" VARCHAR(500),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_steam_id64_key" ON "players"("steam_id64");

-- CreateIndex
CREATE INDEX "steam_profile_snapshots_player_id_fetched_at_idx" ON "steam_profile_snapshots"("player_id", "fetched_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_player_id_started_at_idx" ON "sync_jobs"("player_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- AddForeignKey
ALTER TABLE "steam_profile_snapshots" ADD CONSTRAINT "steam_profile_snapshots_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
