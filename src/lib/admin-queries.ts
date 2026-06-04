/** Read queries for the admin CRM prospect table + detail (spec Phase 3). */
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  categories,
  enrichment,
  listingContent,
  locations,
  outreachContacts,
} from "@/db/schema";

export type ProspectFilters = {
  status?: string;
  town?: string;
  category?: string;
  leadType?: string;
  minScore?: number;
};

export type ProspectRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  town: string | null;
  category: string | null;
  hasWebsite: boolean | null;
  leadType: string[] | null;
  score: number | null;
  email: string | null;
  optedOut: boolean | null;
};

export async function listProspects(
  filters: ProspectFilters,
  limit = 100,
): Promise<ProspectRow[]> {
  const where: SQL[] = [];
  if (filters.status) where.push(eq(businesses.status, filters.status));
  if (filters.town) where.push(eq(locations.slug, filters.town));
  if (filters.category) where.push(eq(categories.slug, filters.category));
  if (filters.minScore != null) where.push(gte(enrichment.score, filters.minScore));
  if (filters.leadType)
    where.push(sql`${enrichment.leadType} @> ARRAY[${filters.leadType}]::text[]`);

  return db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      status: businesses.status,
      town: locations.name,
      category: categories.name,
      hasWebsite: enrichment.hasWebsite,
      leadType: enrichment.leadType,
      score: enrichment.score,
      email: outreachContacts.email,
      optedOut: outreachContacts.optedOut,
    })
    .from(businesses)
    .leftJoin(locations, eq(locations.id, businesses.locationId))
    .leftJoin(categories, eq(categories.id, businesses.categoryId))
    .leftJoin(enrichment, eq(enrichment.businessId, businesses.id))
    .leftJoin(outreachContacts, eq(outreachContacts.businessId, businesses.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(enrichment.score), businesses.name)
    .limit(limit);
}

export async function statusCounts() {
  return db
    .select({ status: businesses.status, count: sql<number>`count(*)::int` })
    .from(businesses)
    .groupBy(businesses.status);
}

export async function getProspectDetail(id: string) {
  const [row] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      placeId: businesses.placeId,
      status: businesses.status,
      town: locations.name,
      category: categories.name,
      enrichment: {
        hasWebsite: enrichment.hasWebsite,
        tech: enrichment.tech,
        packRank: enrichment.packRank,
        leadType: enrichment.leadType,
        score: enrichment.score,
        checkedAt: enrichment.checkedAt,
      },
      content: {
        displayName: listingContent.displayName,
        description: listingContent.description,
        phone: listingContent.phone,
        email: listingContent.email,
        website: listingContent.website,
      },
      contact: {
        id: outreachContacts.id,
        email: outreachContacts.email,
        entityType: outreachContacts.entityType,
        consentBasis: outreachContacts.consentBasis,
        optedOut: outreachContacts.optedOut,
      },
    })
    .from(businesses)
    .leftJoin(locations, eq(locations.id, businesses.locationId))
    .leftJoin(categories, eq(categories.id, businesses.categoryId))
    .leftJoin(enrichment, eq(enrichment.businessId, businesses.id))
    .leftJoin(listingContent, eq(listingContent.businessId, businesses.id))
    .leftJoin(outreachContacts, eq(outreachContacts.businessId, businesses.id))
    .where(eq(businesses.id, id))
    .limit(1);
  return row ?? null;
}
