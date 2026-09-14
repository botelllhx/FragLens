import type {
  PlayerProfile,
  PlayerStore,
  ProfileCacheInfo,
  ProfileVisibility,
  StoredProfile,
  SyncJobResult,
  SyncJobStatus,
  SyncJobType,
} from '@fraglens/core';
import type { PrismaClient } from './generated/prisma/client.js';
import type {
  ProfileVisibility as DbProfileVisibility,
  SyncJobStatus as DbSyncJobStatus,
  SyncJobType as DbSyncJobType,
} from './generated/prisma/enums.js';
import type { SteamProfileSnapshotModel } from './generated/prisma/models.js';

const VISIBILITY_TO_DB: Readonly<Record<ProfileVisibility, DbProfileVisibility>> = {
  public: 'PUBLIC',
  'friends-only': 'FRIENDS_ONLY',
  private: 'PRIVATE',
};

const VISIBILITY_FROM_DB: Readonly<Record<DbProfileVisibility, ProfileVisibility>> = {
  PUBLIC: 'public',
  FRIENDS_ONLY: 'friends-only',
  PRIVATE: 'private',
};

const JOB_TYPE_TO_DB: Readonly<Record<SyncJobType, DbSyncJobType>> = {
  'steam-profile': 'STEAM_PROFILE',
  analysis: 'ANALYSIS',
};

const JOB_TYPE_FROM_DB: Readonly<Record<DbSyncJobType, SyncJobType>> = {
  STEAM_PROFILE: 'steam-profile',
  ANALYSIS: 'analysis',
};

const JOB_STATUS_FROM_DB: Readonly<Record<DbSyncJobStatus, SyncJobStatus>> = {
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
};

const MAX_ERROR_MESSAGE_LENGTH = 500;

export class PrismaPlayerStore implements PlayerStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findLatestProfile(steamId64: string): Promise<StoredProfile | null> {
    const snapshot = await this.prisma.steamProfileSnapshot.findFirst({
      where: { player: { steamId64 } },
      orderBy: { fetchedAt: 'desc' },
    });
    return snapshot
      ? { profile: toPlayerProfile(steamId64, snapshot), dataVersion: snapshot.dataVersion }
      : null;
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    const snapshot = toSnapshotData(profile);
    await this.prisma.player.upsert({
      where: { steamId64: profile.steamId64 },
      create: { steamId64: profile.steamId64, profileSnapshots: { create: snapshot } },
      update: { profileSnapshots: { create: snapshot } },
    });
  }

  async getCacheInfo(steamId64: string): Promise<ProfileCacheInfo | null> {
    const player = await this.prisma.player.findUnique({
      where: { steamId64 },
      include: {
        _count: { select: { profileSnapshots: true } },
        profileSnapshots: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
          select: { fetchedAt: true, dataVersion: true },
        },
        syncJobs: { where: { type: 'STEAM_PROFILE' }, orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });
    if (!player) return null;

    const lastAnalysis = await this.prisma.syncJob.findFirst({
      where: { playerId: player.id, type: 'ANALYSIS', status: 'SUCCEEDED' },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });

    const [latest] = player.profileSnapshots;
    const [job] = player.syncJobs;
    return {
      steamId64,
      firstSeenAt: player.createdAt.toISOString(),
      snapshotCount: player._count.profileSnapshots,
      latestFetchedAt: latest?.fetchedAt.toISOString() ?? null,
      latestDataVersion: latest?.dataVersion ?? null,
      lastSyncJob: job
        ? {
            type: JOB_TYPE_FROM_DB[job.type],
            status: JOB_STATUS_FROM_DB[job.status],
            startedAt: job.startedAt.toISOString(),
            finishedAt: job.finishedAt?.toISOString() ?? null,
            errorCode: job.errorCode,
          }
        : null,
      lastAnalyzedAt: lastAnalysis?.finishedAt?.toISOString() ?? null,
    };
  }

  async startSyncJob(steamId64: string, type: SyncJobType): Promise<string> {
    const job = await this.prisma.syncJob.create({
      data: {
        type: JOB_TYPE_TO_DB[type],
        status: 'RUNNING',
        player: { connectOrCreate: { where: { steamId64 }, create: { steamId64 } } },
      },
      select: { id: true },
    });
    return job.id;
  }

  async finishSyncJob(jobId: string, result: SyncJobResult): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data:
        result.status === 'succeeded'
          ? { status: 'SUCCEEDED', finishedAt: new Date() }
          : {
              status: 'FAILED',
              finishedAt: new Date(),
              errorCode: result.errorCode.slice(0, 64),
              errorMessage: result.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH),
            },
    });
  }
}

function toSnapshotData(profile: PlayerProfile) {
  const { summary, bans, cs2 } = profile;
  return {
    personaName: summary.personaName,
    profileUrl: summary.profileUrl,
    avatarUrl: summary.avatarUrl,
    visibility: VISIBILITY_TO_DB[summary.visibility],
    countryCode: summary.countryCode,
    accountCreatedAt: summary.accountCreatedAt ? new Date(summary.accountCreatedAt) : null,
    cs2PlaytimeVisible: cs2.visible,
    cs2TotalHours: cs2.totalHours,
    cs2LastTwoWeeksHours: cs2.lastTwoWeeksHours,
    vacBanned: bans?.vacBanned ?? null,
    vacBanCount: bans?.vacBanCount ?? null,
    gameBanCount: bans?.gameBanCount ?? null,
    communityBanned: bans?.communityBanned ?? null,
    economyBan: bans?.economyBan ?? null,
    daysSinceLastBan: bans?.daysSinceLastBan ?? null,
    dataVersion: profile.dataVersion,
    fetchedAt: new Date(profile.fetchedAt),
  };
}

function toPlayerProfile(steamId64: string, snapshot: SteamProfileSnapshotModel): PlayerProfile {
  const hasBans =
    snapshot.vacBanCount !== null &&
    snapshot.gameBanCount !== null &&
    snapshot.vacBanned !== null &&
    snapshot.communityBanned !== null &&
    snapshot.economyBan !== null;

  return {
    steamId64,
    summary: {
      steamId64,
      personaName: snapshot.personaName,
      profileUrl: snapshot.profileUrl,
      avatarUrl: snapshot.avatarUrl,
      visibility: VISIBILITY_FROM_DB[snapshot.visibility],
      countryCode: snapshot.countryCode,
      accountCreatedAt: snapshot.accountCreatedAt?.toISOString() ?? null,
    },
    bans: hasBans
      ? {
          vacBanned: snapshot.vacBanned ?? false,
          vacBanCount: snapshot.vacBanCount ?? 0,
          gameBanCount: snapshot.gameBanCount ?? 0,
          communityBanned: snapshot.communityBanned ?? false,
          economyBan: snapshot.economyBan ?? 'none',
          daysSinceLastBan: snapshot.daysSinceLastBan,
        }
      : null,
    cs2: {
      visible: snapshot.cs2PlaytimeVisible,
      totalHours: snapshot.cs2TotalHours,
      lastTwoWeeksHours: snapshot.cs2LastTwoWeeksHours,
    },
    dataVersion: snapshot.dataVersion,
    cached: false,
    fetchedAt: snapshot.fetchedAt.toISOString(),
  };
}
