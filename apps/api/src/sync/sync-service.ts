import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database } from "../database/database.js";

const syncMutationSchema = z.object({
  clientMutationId: z.string().uuid(),
  type: z.literal("sync.test"),
  createdAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()).default({})
});

const syncPushSchema = z.object({
  tripId: z.string().uuid().nullable().optional(),
  clientDeviceId: z.string().uuid(),
  mutations: z.array(syncMutationSchema).min(1).max(50)
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;

export interface SyncActor {
  userId: string;
}

export class SyncService {
  constructor(private readonly database: Database) {}

  async push(input: unknown, actor: SyncActor) {
    const parsed = syncPushSchema.parse(input);
    const results = [];

    for (const mutation of parsed.mutations) {
      const existing = await this.findMutation(
        parsed.clientDeviceId,
        mutation.clientMutationId
      );

      if (existing) {
        results.push({
          clientMutationId: mutation.clientMutationId,
          status: "duplicate",
          serverEntityId: existing.server_entity_id,
          serverVersion: null
        });
        continue;
      }

      const mutationId = randomUUID();
      const serverEntityId = randomUUID();

      await this.database.query(
        `
          insert into client_devices (id, last_seen_at)
          values ($1, now())
          on conflict (id) do update set last_seen_at = excluded.last_seen_at
        `,
        [parsed.clientDeviceId]
      );
      await this.database.query(
        `
          insert into sync_mutations (
            id,
            trip_id,
            actor_user_id,
            client_device_id,
            client_mutation_id,
            mutation_type,
            payload,
            status,
            server_entity_id,
            applied_at
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'applied', $8, now())
        `,
        [
          mutationId,
          parsed.tripId ?? null,
          actor.userId,
          parsed.clientDeviceId,
          mutation.clientMutationId,
          mutation.type,
          JSON.stringify(mutation.payload),
          serverEntityId
        ]
      );

      results.push({
        clientMutationId: mutation.clientMutationId,
        status: "applied",
        serverEntityId,
        serverVersion: null
      });
    }

    return { results };
  }

  private async findMutation(clientDeviceId: string, clientMutationId: string) {
    const result = await this.database.query<{
      server_entity_id: string | null;
    }>(
      `
        select server_entity_id
        from sync_mutations
        where client_device_id = $1 and client_mutation_id = $2
        limit 1
      `,
      [clientDeviceId, clientMutationId]
    );

    return result.rows[0] ?? null;
  }
}

