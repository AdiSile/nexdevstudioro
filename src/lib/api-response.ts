/**
 * API Response Standardization — Envelope, Pagination, Filtering, Sorting, HATEOAS Links
 *
 * Production-grade, consistent API response shapes for every endpoint in the
 * application. All API routes and server actions MUST use these builders to
 * guarantee a uniform contract for internal consumers (the admin UI, the
 * public storefront, the mobile app) and external integrations.
 *
 * Architecture:
 *   1. **Response Envelope** — every response is wrapped in:
 *        {
 *          success: boolean,
 *          data: T | null,
 *          error: SerializedError | null,
 *          meta: ResponseMeta,
 *          links: HateoasLink[],
 *        }
 *      - `success: true`  → data present, error is null
 *      - `success: false` → data null, error present (see error-handler.ts)
 *   2. **Pagination** — both cursor-based (infinite scroll / real-time feeds)
 *      and offset-based (traditional page numbers) with full metadata.
 *   3. **Filtering** — typed filter builders with operators (eq, neq, gt, gte,
 *      lt, lte, in, nin, like, between, exists, regex) and AND/OR combinator.
 *   4. **Sorting** — multi-field sort with direction (`asc`/`desc`) and
 *      nulls-position control (`first`/`last`).
 *   5. **HATEOAS Links** — RFC 8288 Web Linking. Every collection response
 *      includes `self`, `first`, `prev`, `next`, `last` links. Resource
 *      responses include `self`, parent relations, and available actions.
 *
 * Usage — Success Responses:
 *   import { buildSuccessResponse, buildCollectionResponse } from "@/lib/api-response";
 *
 *   // Single resource
 *   return buildSuccessResponse(user, {
 *     links: [selfLink("/api/users/usr_123"), collectionLink("/api/users")],
 *   });
 *
 *   // Collection with pagination
 *   return buildCollectionResponse(users, {
 *     pagination: { offset: 0, limit: 20, total: 150 },
 *     baseUrl: "/api/users",
 *     sort: [{ field: "createdAt", direction: "desc" }],
 *   });
 *
 * Usage — Filtering & Sorting from Request:
 *   import { parsePagination, parseFilters, parseSort } from "@/lib/api-response";
 *
 *   const pagination = parsePagination(req.nextUrl.searchParams);
 *   const filters = parseFilters(req.nextUrl.searchParams, allowedFilters);
 *   const sort = parseSort(req.nextUrl.searchParams, allowedSortFields);
 *
 *   const result = await service.list({ pagination, filters, sort });
 *   return buildCollectionResponse(result.items, { pagination, baseUrl, sort });
 *
 * Usage — Error Responses (delegates to error-handler.ts):
 *   import { buildErrorResponse, handleError } from "@/lib/error-handler";
 *   // ...or use the unified `buildApiErrorResponse` re-exported here
 *
 * Response Structure (success: true):
 *   {
 *     "success": true,
 *     "data": { ... },
 *     "error": null,
 *     "meta": {
 *       "timestamp": "2025-01-15T10:30:00.000Z",
 *       "requestId": "req_abc123",
 *       "version": "1",
 *       "pagination": { "offset": 0, "limit": 20, "total": 150, "totalPages": 8, "hasMore": true }
 *     },
 *     "links": [
 *       { "rel": "self", "href": "/api/users?offset=0&limit=20", "method": "GET" },
 *       { "rel": "next", "href": "/api/users?offset=20&limit=20", "method": "GET" },
 *       { "rel": "last", "href": "/api/users?offset=140&limit=20", "method": "GET" }
 *     ]
 *   }
 *
 * Environment Variables:
 *   API_DEFAULT_PAGE_SIZE        — default page/limit size (default: 20)
 *   API_MAX_PAGE_SIZE            — maximum allowed limit (default: 100)
 *   API_MAX_OFFSET               — maximum offset cursor (default: 10000)
 *   API_INCLUDE_HATEOAS          — include HATEOAS links in responses (default: true)
 *   API_RESPONSE_VERSION         — API version string in meta (default: "1")
 *   API_ALLOW_ORIGIN             — CORS Allow-Origin for HATEOAS links (default: *)
 */

import {
  AppError,
  ErrorCode,
  type SerializedError,
  buildErrorResponse as buildCoreErrorResponse,
  type ErrorResponse,
} from "@/lib/error-handler"

// ---------------------------------------------------------------------------
// Types — Response Envelope
// ---------------------------------------------------------------------------

/** Metadata attached to every API response */
export interface ResponseMeta {
  /** ISO 8601 timestamp of response generation */
  timestamp: string
  /** Correlation / request ID for tracing */
  requestId?: string
  /** API version */
  version: string
  /** Pagination metadata (only for collection responses) */
  pagination?: PaginationMeta | CursorPaginationMeta
  /** Applied filters summary (echoed for debugging) */
  filters?: AppliedFilterSummary[]
  /** Applied sort summary (echoed for debugging) */
  sort?: SortSummary[]
  /** Additional unstructured metadata */
  [key: string]: unknown
}

/** Standard success response envelope */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  error: null
  meta: ResponseMeta
  links: HateoasLink[]
}

/** Standard error response envelope (compatible with error-handler.ts) */
export interface ApiErrorResponse {
  success: false
  data: null
  error: SerializedError
  meta: ResponseMeta
  links: HateoasLink[]
}

/** Union of all possible API response shapes */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// ---------------------------------------------------------------------------
// Types — HATEOAS Links (RFC 8288)
// ---------------------------------------------------------------------------

/**
 * A single HATEOAS link following RFC 8288 Web Linking conventions.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8288
 */
export interface HateoasLink {
  /** Link relation type (self, next, prev, first, last, create, update, delete, etc.) */
  rel: string
  /** Absolute or relative URI */
  href: string
  /** HTTP method for the link target */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** Human-readable title */
  title?: string
  /** MIME type of the target resource */
  type?: string
  /** Whether the link is templated (RFC 6570 URI Template) */
  templated?: boolean
  /** Whether the link is deprecated */
  deprecation?: boolean
  /** Additional attributes */
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Types — Pagination
// ---------------------------------------------------------------------------

/** Offset-based pagination parameters (input from request) */
export interface PaginationParams {
  /** Zero-based offset (page number * limit) */
  offset: number
  /** Items per page */
  limit: number
}

/** Offset-based pagination metadata (output in response) */
export interface PaginationMeta {
  /** Pagination strategy */
  type: "offset"
  /** Current zero-based offset */
  offset: number
  /** Items per page */
  limit: number
  /** Total number of items across all pages */
  total: number
  /** Total number of pages */
  totalPages: number
  /** Whether there are more pages after this one */
  hasMore: boolean
  /** Current page number (1-based) */
  page: number
}

/** Cursor-based pagination parameters (input from request) */
export interface CursorPaginationParams {
  /** Opaque cursor pointing to the item after which results start */
  cursor?: string
  /** Items to fetch */
  limit: number
  /** Direction: "forward" (ascending) or "backward" (descending from cursor) */
  direction?: "forward" | "backward"
}

/** Cursor-based pagination metadata (output in response) */
export interface CursorPaginationMeta {
  /** Pagination strategy */
  type: "cursor"
  /** Cursor for the first item in this page */
  startCursor?: string
  /** Cursor for the last item in this page */
  endCursor?: string
  /** Cursor for the next page (null if no more) */
  nextCursor?: string
  /** Cursor for the previous page (null if at start) */
  previousCursor?: string
  /** Items in this page */
  limit: number
  /** Whether there are more items after this page */
  hasMore: boolean
  /** Whether there are more items before this page */
  hasPrevious: boolean
  /** Total count (optional — expensive on large datasets) */
  total?: number
}

// ---------------------------------------------------------------------------
// Types — Filtering
// ---------------------------------------------------------------------------

/** Filter operators */
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "like"
  | "between"
  | "exists"
  | "regex"

/** A single filter condition */
export interface FilterCondition {
  field: string
  operator: FilterOperator
  value: unknown
}

/** Logical AND group of filters */
export interface FilterGroupAnd {
  combinator: "and"
  conditions: FilterClause[]
}

/** Logical OR group of filters */
export interface FilterGroupOr {
  combinator: "or"
  conditions: FilterClause[]
}

/** A filter clause is either a single condition or a logical group */
export type FilterClause = FilterCondition | FilterGroupAnd | FilterGroupOr

/** Top-level filter structure */
export interface FilterParams {
  /** Root combinator: "and" or "or" */
  combinator: "and" | "or"
  /** Array of filter clauses */
  conditions: FilterClause[]
}

/** Summary of an applied filter (echoed in response meta) */
export interface AppliedFilterSummary {
  field: string
  operator: FilterOperator
  value: unknown
}

// ---------------------------------------------------------------------------
// Types — Sorting
// ---------------------------------------------------------------------------

/** Sort direction */
export type SortDirection = "asc" | "desc"

/** Null values positioning */
export type NullsPosition = "first" | "last"

/** A single sort specification */
export interface SortSpec {
  field: string
  direction: SortDirection
  /** Where null values should appear (default: "last" for asc, "first" for desc) */
  nulls?: NullsPosition
}

/** Sort summary echoed in response meta */
export interface SortSummary {
  field: string
  direction: SortDirection
}

// ---------------------------------------------------------------------------
// Types — Field Projection / Sparse Fieldsets
// ---------------------------------------------------------------------------

/**
 * Field projection: which fields to include or exclude in the response.
 *
 * Supports:
 *   - `include: ["id", "name", "email"]` → sparse fieldset (only return these)
 *   - `exclude: ["passwordHash", "secret"]` → exclude sensitive fields
 *   - If both are set, `include` wins and `exclude` is ignored.
 */
export interface FieldProjection {
  include?: string[]
  exclude?: string[]
}

// ---------------------------------------------------------------------------
// Types — Response Builder Options
// ---------------------------------------------------------------------------

/** Options for building a single-resource success response */
export interface BuildSuccessOptions {
  /** Request ID for tracing */
  requestId?: string
  /** API version override */
  version?: string
  /** HATEOAS links to include */
  links?: HateoasLink[]
  /** Additional metadata */
  meta?: Record<string, unknown>
}

/** Options for building a collection success response */
export interface BuildCollectionOptions<T = unknown> {
  /** Pagination metadata (one or the other) */
  pagination?: PaginationMeta | CursorPaginationMeta
  /** Base URL for generating HATEOAS links (e.g., "/api/users") */
  baseUrl?: string
  /** Applied sort (echoed in meta) */
  sort?: SortSpec[]
  /** Applied filters (echoed in meta) */
  filters?: FilterParams
  /** Request ID for tracing */
  requestId?: string
  /** API version override */
  version?: string
  /** Extra HATEOAS links beyond the auto-generated pagination links */
  extraLinks?: HateoasLink[]
  /** Additional metadata */
  meta?: Record<string, unknown>
  /** Function to extract the cursor from an item (for cursor-based pagination) */
  cursorExtractor?: (item: T) => string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  const raw = process.env[key]
  return raw !== undefined && raw !== "" ? raw : fallback
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === "") return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === "") return fallback
  return raw === "true" || raw === "1"
}

export interface ApiResponseConfig {
  defaultPageSize: number
  maxPageSize: number
  maxOffset: number
  includeHateoas: boolean
  responseVersion: string
  allowOrigin: string
}

function buildConfig(): ApiResponseConfig {
  return {
    defaultPageSize: envInt("API_DEFAULT_PAGE_SIZE", 20),
    maxPageSize: envInt("API_MAX_PAGE_SIZE", 100),
    maxOffset: envInt("API_MAX_OFFSET", 10000),
    includeHateoas: envBool("API_INCLUDE_HATEOAS", true),
    responseVersion: envStr("API_RESPONSE_VERSION", "1"),
    allowOrigin: envStr("API_ALLOW_ORIGIN", "*"),
  }
}

let _config: ApiResponseConfig | undefined

function getConfig(): ApiResponseConfig {
  if (!_config) {
    _config = buildConfig()
  }
  return _config
}

/** Reload configuration at runtime */
export function reloadApiResponseConfig(): ApiResponseConfig {
  _config = buildConfig()
  return _config
}

// ---------------------------------------------------------------------------
// HATEOAS Link Builders
// ---------------------------------------------------------------------------

/**
 * Build a `self` link for a resource.
 */
export function selfLink(href: string, method: "GET" = "GET", title?: string): HateoasLink {
  return { rel: "self", href, method, title }
}

/**
 * Build a `collection` link pointing to the parent collection.
 */
export function collectionLink(
  href: string,
  title?: string,
): HateoasLink {
  return { rel: "collection", href, method: "GET", title: title ?? "Back to collection" }
}

/**
 * Build a `create` action link.
 */
export function createLink(href: string, title?: string): HateoasLink {
  return { rel: "create", href, method: "POST", title: title ?? "Create new resource" }
}

/**
 * Build an `update` action link.
 */
export function updateLink(href: string, title?: string): HateoasLink {
  return { rel: "update", href, method: "PUT", title: title ?? "Update this resource" }
}

/**
 * Build a `delete` action link.
 */
export function deleteLink(href: string, title?: string): HateoasLink {
  return { rel: "delete", href, method: "DELETE", title: title ?? "Delete this resource" }
}

/**
 * Build a `related` link (e.g., user → projects).
 */
export function relatedLink(
  rel: string,
  href: string,
  method: "GET" = "GET",
  title?: string,
): HateoasLink {
  return { rel, href, method, title }
}

// ---------------------------------------------------------------------------
// Pagination — Offset-Based
// ---------------------------------------------------------------------------

/**
 * Build offset-based pagination metadata from the result of a list query.
 *
 * @param offset — current zero-based offset
 * @param limit  — current page size
 * @param total  — total number of items
 * @returns PaginationMeta ready for the response envelope
 */
export function buildOffsetPagination(
  offset: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0
  const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

  return {
    type: "offset",
    offset,
    limit,
    total,
    totalPages,
    hasMore: offset + limit < total,
    page,
  }
}

/**
 * Parse offset-based pagination from URL search params.
 *
 * Query parameters:
 *   - `page`  — 1-based page number (default: 1)
 *   - `limit` — items per page (default: API_DEFAULT_PAGE_SIZE, max: API_MAX_PAGE_SIZE)
 *
 * Automatically clamps offset to API_MAX_OFFSET.
 */
export function parsePagination(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): PaginationParams {
  const config = getConfig()

  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined
    }
    const val = searchParams[key]
    return Array.isArray(val) ? val[0] : val
  }

  const pageRaw = getParam("page")
  const limitRaw = getParam("limit")

  const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1)
  const limit = Math.min(
    config.maxPageSize,
    Math.max(1, parseInt(limitRaw ?? String(config.defaultPageSize), 10) || config.defaultPageSize),
  )

  const offset = Math.min(config.maxOffset, (page - 1) * limit)

  return { offset, limit }
}

/**
 * Generate offset-based pagination HATEOAS links.
 */
export function buildOffsetPaginationLinks(
  baseUrl: string,
  pagination: PaginationMeta,
  extraQueryParams?: Record<string, string>,
): HateoasLink[] {
  const config = getConfig()
  if (!config.includeHateoas) return []

  const links: HateoasLink[] = []
  const { offset, limit } = pagination

  // Build URL without pagination params — preserve existing filters & sort
  const base = new URL(baseUrl, "http://localhost")
  if (extraQueryParams) {
    for (const [key, value] of Object.entries(extraQueryParams)) {
      base.searchParams.set(key, value)
    }
  }

  // Self
  const selfUrl = new URL(base.toString())
  selfUrl.searchParams.set("offset", String(offset))
  selfUrl.searchParams.set("limit", String(limit))
  links.push({
    rel: "self",
    href: selfUrl.pathname + selfUrl.search,
    method: "GET",
    title: `Page ${pagination.page} of ${pagination.totalPages}`,
  })

  // First
  if (offset > 0) {
    const firstUrl = new URL(base.toString())
    firstUrl.searchParams.set("offset", "0")
    firstUrl.searchParams.set("limit", String(limit))
    links.push({
      rel: "first",
      href: firstUrl.pathname + firstUrl.search,
      method: "GET",
      title: "First page",
    })
  }

  // Previous
  if (offset > 0) {
    const prevOffset = Math.max(0, offset - limit)
    const prevUrl = new URL(base.toString())
    prevUrl.searchParams.set("offset", String(prevOffset))
    prevUrl.searchParams.set("limit", String(limit))
    links.push({
      rel: "prev",
      href: prevUrl.pathname + prevUrl.search,
      method: "GET",
      title: `Page ${pagination.page - 1}`,
    })
  }

  // Next
  if (pagination.hasMore) {
    const nextOffset = offset + limit
    const nextUrl = new URL(base.toString())
    nextUrl.searchParams.set("offset", String(nextOffset))
    nextUrl.searchParams.set("limit", String(limit))
    links.push({
      rel: "next",
      href: nextUrl.pathname + nextUrl.search,
      method: "GET",
      title: `Page ${pagination.page + 1}`,
    })
  }

  // Last
  if (pagination.totalPages > 1 && pagination.hasMore) {
    const lastOffset = Math.max(0, (pagination.totalPages - 1) * limit)
    const lastUrl = new URL(base.toString())
    lastUrl.searchParams.set("offset", String(lastOffset))
    lastUrl.searchParams.set("limit", String(limit))
    links.push({
      rel: "last",
      href: lastUrl.pathname + lastUrl.search,
      method: "GET",
      title: `Last page (${pagination.totalPages})`,
    })
  }

  return links
}

// ---------------------------------------------------------------------------
// Pagination — Cursor-Based
// ---------------------------------------------------------------------------

/**
 * Build cursor-based pagination metadata.
 *
 * @param items          — the items in the current page
 * @param limit          — requested page size
 * @param cursorExtractor — function to get the cursor from an item
 * @param hasMore        — whether there are more items after this page
 * @param hasPrevious    — whether there are items before this page
 * @param total          — optional total count
 */
export function buildCursorPagination<T>(
  items: T[],
  limit: number,
  cursorExtractor: (item: T) => string,
  hasMore: boolean,
  hasPrevious: boolean = false,
  total?: number,
): CursorPaginationMeta {
  return {
    type: "cursor",
    startCursor: items.length > 0 ? cursorExtractor(items[0]!) : undefined,
    endCursor: items.length > 0 ? cursorExtractor(items[items.length - 1]!) : undefined,
    nextCursor: hasMore && items.length > 0 ? cursorExtractor(items[items.length - 1]!) : undefined,
    previousCursor: hasPrevious && items.length > 0 ? cursorExtractor(items[0]!) : undefined,
    limit,
    hasMore,
    hasPrevious,
    total,
  }
}

/**
 * Parse cursor-based pagination from URL search params.
 *
 * Query parameters:
 *   - `cursor`    — opaque cursor string
 *   - `limit`     — items per page
 *   - `direction` — "forward" or "backward"
 */
export function parseCursorPagination(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): CursorPaginationParams {
  const config = getConfig()

  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined
    }
    const val = searchParams[key]
    return Array.isArray(val) ? val[0] : val
  }

  const cursor = getParam("cursor") ?? undefined
  const limitRaw = getParam("limit")
  const limit = Math.min(
    config.maxPageSize,
    Math.max(1, parseInt(limitRaw ?? String(config.defaultPageSize), 10) || config.defaultPageSize),
  )
  const directionRaw = getParam("direction")
  const direction: "forward" | "backward" =
    directionRaw === "backward" ? "backward" : "forward"

  return { cursor, limit, direction }
}

/**
 * Generate cursor-based pagination HATEOAS links.
 */
export function buildCursorPaginationLinks(
  baseUrl: string,
  pagination: CursorPaginationMeta,
  extraQueryParams?: Record<string, string>,
): HateoasLink[] {
  const config = getConfig()
  if (!config.includeHateoas) return []

  const links: HateoasLink[] = []
  const base = new URL(baseUrl, "http://localhost")
  base.searchParams.set("limit", String(pagination.limit))

  if (extraQueryParams) {
    for (const [key, value] of Object.entries(extraQueryParams)) {
      base.searchParams.set(key, value)
    }
  }

  // Self
  const selfUrl = new URL(base.toString())
  if (pagination.startCursor) {
    selfUrl.searchParams.set("cursor", pagination.startCursor)
    selfUrl.searchParams.set("direction", "forward")
  }
  links.push({
    rel: "self",
    href: selfUrl.pathname + selfUrl.search,
    method: "GET",
    title: "Current page",
  })

  // Next
  if (pagination.hasMore && pagination.nextCursor) {
    const nextUrl = new URL(base.toString())
    nextUrl.searchParams.set("cursor", pagination.nextCursor)
    nextUrl.searchParams.set("direction", "forward")
    links.push({
      rel: "next",
      href: nextUrl.pathname + nextUrl.search,
      method: "GET",
      title: "Next page",
    })
  }

  // Previous
  if (pagination.hasPrevious && pagination.previousCursor) {
    const prevUrl = new URL(base.toString())
    prevUrl.searchParams.set("cursor", pagination.previousCursor)
    prevUrl.searchParams.set("direction", "backward")
    links.push({
      rel: "prev",
      href: prevUrl.pathname + prevUrl.search,
      method: "GET",
      title: "Previous page",
    })
  }

  return links
}

// ---------------------------------------------------------------------------
// Filter Parsing & Building
// ---------------------------------------------------------------------------

/**
 * Allowed filter definition: what fields the client is allowed to filter on
 * and which operators are supported per field.
 */
export interface AllowedFilter {
  field: string
  operators: FilterOperator[]
  /** Optional: alias (maps external query param name to internal field name) */
  alias?: string
  /** Optional: type coercion (e.g., "number", "boolean", "date") */
  type?: "string" | "number" | "boolean" | "date"
}

/**
 * Parse filter parameters from URL search params.
 *
 * Query parameter format (LHS bracket syntax):
 *   ?filter[status]=published
 *   ?filter[status:in]=draft,review
 *   ?filter[price:gte]=100
 *   ?filter[price:lt]=500
 *   ?filter[createdAt:between]=2024-01-01,2024-12-31
 *   ?filter[name:like]=%john%
 *   ?filter[deletedAt:exists]=false
 *
 * The parser validates against the `allowed` list and silently drops
 * disallowed fields/operators to prevent injection.
 */
export function parseFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  allowed: AllowedFilter[],
  combinator: "and" | "or" = "and",
): FilterParams {
  const conditions: FilterClause[] = []
  const allowedMap = new Map<string, AllowedFilter>()
  for (const a of allowed) {
    allowedMap.set(a.field, a)
    if (a.alias) allowedMap.set(a.alias, a)
  }

  const getParamEntries = (): Array<[string, string]> => {
    if (searchParams instanceof URLSearchParams) {
      return Array.from(searchParams.entries())
    }
    return Object.entries(searchParams).flatMap(([key, val]) => {
      if (Array.isArray(val)) return val.map((v) => [key, v] as [string, string])
      if (val !== undefined) return [[key, val] as [string, string]]
      return []
    })
  }

  const entries = getParamEntries()

  for (const [rawKey, rawValue] of entries) {
    if (!rawKey.startsWith("filter[")) continue

    // Parse filter[field:operator]
    const match = rawKey.match(/^filter\[([^:\]]+)(?::([^\]]+))?\]$/)
    if (!match) continue

    const fieldKey = match[1]!
    const operatorRaw = match[2] ?? "eq"
    const operator = operatorRaw as FilterOperator

    // Validate operator
    const validOps: FilterOperator[] = [
      "eq", "neq", "gt", "gte", "lt", "lte",
      "in", "nin", "like", "between", "exists", "regex",
    ]
    if (!validOps.includes(operator)) continue

    // Validate field is allowed
    const allowedDef = allowedMap.get(fieldKey)
    if (!allowedDef) continue
    if (!allowedDef.operators.includes(operator)) continue

    const actualField = allowedDef.alias ? allowedDef.field : fieldKey

    // Parse value with type coercion
    const parsedValue = coerceFilterValue(rawValue, operator, allowedDef.type)

    conditions.push({
      field: actualField,
      operator,
      value: parsedValue,
    })
  }

  return { combinator, conditions }
}

/**
 * Coerce a raw string value to the appropriate type for a filter condition.
 */
function coerceFilterValue(
  raw: string,
  operator: FilterOperator,
  type?: "string" | "number" | "boolean" | "date",
): unknown {
  // in / nin: comma-separated list
  if (operator === "in" || operator === "nin") {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
    return parts.map((p) => coerceScalar(p, type))
  }

  // between: two comma-separated values
  if (operator === "between") {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length !== 2) return [null, null]
    return [coerceScalar(parts[0]!, type), coerceScalar(parts[1]!, type)]
  }

  // exists: boolean
  if (operator === "exists") {
    return raw.toLowerCase() === "true" || raw === "1"
  }

  return coerceScalar(raw, type)
}

function coerceScalar(raw: string, type?: "string" | "number" | "boolean" | "date"): unknown {
  switch (type) {
    case "number": {
      const n = Number(raw)
      return Number.isFinite(n) ? n : raw
    }
    case "boolean":
      return raw.toLowerCase() === "true" || raw === "1"
    case "date": {
      const d = new Date(raw)
      return isNaN(d.getTime()) ? raw : d.toISOString()
    }
    default:
      return raw
  }
}

/**
 * Build a filter condition manually (programmatic use).
 */
export function filterCondition(
  field: string,
  operator: FilterOperator,
  value: unknown,
): FilterCondition {
  return { field, operator, value }
}

/**
 * Build an AND group of filter clauses.
 */
export function andFilter(...conditions: FilterClause[]): FilterGroupAnd {
  return { combinator: "and", conditions }
}

/**
 * Build an OR group of filter clauses.
 */
export function orFilter(...conditions: FilterClause[]): FilterGroupOr {
  return { combinator: "or", conditions }
}

/**
 * Convert applied FilterParams to a summary array for response meta.
 */
export function summarizeFilters(filters: FilterParams): AppliedFilterSummary[] {
  const summaries: AppliedFilterSummary[] = []

  const walk = (clauses: FilterClause[]) => {
    for (const clause of clauses) {
      if ("combinator" in clause) {
        walk(clause.conditions)
      } else {
        summaries.push({
          field: clause.field,
          operator: clause.operator,
          value: clause.value,
        })
      }
    }
  }

  walk(filters.conditions)
  return summaries
}

/**
 * Convert FilterParams to a Prisma-compatible `where` object.
 *
 * This bridges the API filter layer to the Prisma query layer.
 * Only supports a subset of filter operators natively; others
 * require additional processing at the service layer.
 *
 * @example
 *   const filters = parseFilters(req.nextUrl.searchParams, allowedFilters)
 *   const prismaWhere = filtersToPrismaWhere(filters)
 *   const items = await prisma.user.findMany({ where: prismaWhere })
 */
export function filtersToPrismaWhere(
  filters: FilterParams,
): Record<string, unknown> {
  const buildClause = (clause: FilterClause): Record<string, unknown> => {
    if ("combinator" in clause) {
      const subConditions = clause.conditions.map(buildClause)
      return { [clause.combinator === "and" ? "AND" : "OR"]: subConditions }
    }

    const { field, operator, value } = clause

    switch (operator) {
      case "eq":
        return { [field]: value }
      case "neq":
        return { [field]: { not: value } }
      case "gt":
        return { [field]: { gt: value } }
      case "gte":
        return { [field]: { gte: value } }
      case "lt":
        return { [field]: { lt: value } }
      case "lte":
        return { [field]: { lte: value } }
      case "in":
        return { [field]: { in: Array.isArray(value) ? value : [value] } }
      case "nin":
        return { [field]: { notIn: Array.isArray(value) ? value : [value] } }
      case "like":
        return { [field]: { contains: String(value).replace(/%/g, "") } }
      case "between": {
        const [min, max] = Array.isArray(value) ? value : [null, null]
        return { [field]: { gte: min, lte: max } }
      }
      case "exists":
        return value ? { [field]: { not: null } } : { [field]: null }
      case "regex":
        return { [field]: { matches: String(value) } }
      default:
        return { [field]: value }
    }
  }

  const built = filters.conditions.map(buildClause)
  if (built.length === 0) return {}
  if (built.length === 1) return built[0]!
  return {
    [filters.combinator === "and" ? "AND" : "OR"]: built,
  }
}

// ---------------------------------------------------------------------------
// Sort Parsing & Building
// ---------------------------------------------------------------------------

/**
 * Parse sort parameters from URL search params.
 *
 * Query parameter format:
 *   ?sort=createdAt:desc,name:asc
 *   ?sort=-createdAt,name             (compact: -desc, +asc/default)
 *
 * Only fields in `allowedFields` are accepted.
 */
export function parseSort(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  allowedFields: string[],
  defaultSort?: SortSpec[],
): SortSpec[] {
  const allowedSet = new Set(allowedFields)

  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined
    }
    const val = searchParams[key]
    return Array.isArray(val) ? val[0] : val
  }

  const sortRaw = getParam("sort")
  if (!sortRaw) return defaultSort ?? []

  const specs: SortSpec[] = []
  const parts = sortRaw.split(",").map((s) => s.trim()).filter(Boolean)

  for (const part of parts) {
    let field: string
    let direction: SortDirection = "asc"
    let nulls: NullsPosition | undefined

    // Compact format: -field (desc), field (asc)
    if (part.startsWith("-")) {
      field = part.slice(1)
      direction = "desc"
      nulls = "first"
    } else if (part.startsWith("+")) {
      field = part.slice(1)
      direction = "asc"
      nulls = "last"
    }
    // Explicit format: field:asc, field:desc:nullsFirst, field:desc:nullsLast
    else if (part.includes(":")) {
      const segments = part.split(":")
      field = segments[0]!
      const dirRaw = segments[1]
      direction = dirRaw === "desc" ? "desc" : "asc"

      if (segments[2]) {
        if (segments[2] === "nullsFirst" || segments[2] === "first") {
          nulls = "first"
        } else {
          nulls = "last"
        }
      } else {
        nulls = direction === "desc" ? "first" : "last"
      }
    } else {
      field = part
      direction = "asc"
      nulls = "last"
    }

    if (allowedSet.has(field) || allowedSet.has("*")) {
      specs.push({ field, direction, nulls })
    }
  }

  return specs.length > 0 ? specs : (defaultSort ?? [])
}

/**
 * Build a SortSpec manually.
 */
export function sortSpec(
  field: string,
  direction: SortDirection = "asc",
  nulls?: NullsPosition,
): SortSpec {
  return { field, direction, nulls }
}

/**
 * Convert sort specs to summary array for response meta.
 */
export function summarizeSort(sort: SortSpec[]): SortSummary[] {
  return sort.map((s) => ({ field: s.field, direction: s.direction }))
}

/**
 * Convert SortSpec array to a Prisma-compatible `orderBy` array.
 */
export function sortToPrismaOrderBy(
  sort: SortSpec[],
): Array<Record<string, string>> {
  return sort.map((s) => ({
    [s.field]: s.direction,
  }))
}

// ---------------------------------------------------------------------------
// Field Projection Parsing
// ---------------------------------------------------------------------------

/**
 * Parse sparse fieldset / field projection from URL search params.
 *
 * Query parameter format:
 *   ?fields=id,name,email             → include only these
 *   ?exclude=passwordHash,totpSecret  → exclude these
 */
export function parseFieldProjection(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): FieldProjection {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined
    }
    const val = searchParams[key]
    return Array.isArray(val) ? val[0] : val
  }

  const fieldsRaw = getParam("fields")
  const excludeRaw = getParam("exclude")

  const result: FieldProjection = {}

  if (fieldsRaw) {
    result.include = fieldsRaw.split(",").map((s) => s.trim()).filter(Boolean)
  }

  if (excludeRaw) {
    result.exclude = excludeRaw.split(",").map((s) => s.trim()).filter(Boolean)
  }

  return result
}

// ---------------------------------------------------------------------------
// Response Envelope — Success Builders
// ---------------------------------------------------------------------------

/**
 * Build a standardized success response for a single resource.
 *
 * @param data  — the resource to return
 * @param opts  — options: requestId, version, links, extra meta
 * @returns ApiSuccessResponse<T>
 *
 * @example
 *   return buildSuccessResponse(user, {
 *     links: [selfLink(`/api/users/${user.id}`), collectionLink("/api/users")],
 *   })
 */
export function buildSuccessResponse<T>(
  data: T,
  opts: BuildSuccessOptions = {},
): ApiSuccessResponse<T> {
  const config = getConfig()

  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    requestId: opts.requestId,
    version: opts.version ?? config.responseVersion,
    ...opts.meta,
  }

  const links = opts.links ?? []

  return {
    success: true,
    data,
    error: null,
    meta,
    links,
  }
}

/**
 * Build a standardized success response for a collection of resources.
 *
 * @param items      — array of resources
 * @param opts       — pagination, baseUrl, sort, filters, links, meta
 * @returns ApiSuccessResponse<T[]>
 *
 * @example
 *   return buildCollectionResponse(users, {
 *     pagination: buildOffsetPagination(0, 20, 150),
 *     baseUrl: "/api/users",
 *     sort: [{ field: "createdAt", direction: "desc" }],
 *   })
 */
export function buildCollectionResponse<T>(
  items: T[],
  opts: BuildCollectionOptions<T> = {},
): ApiSuccessResponse<T[]> {
  const config = getConfig()

  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    requestId: opts.requestId,
    version: opts.version ?? config.responseVersion,
    pagination: opts.pagination,
    filters: opts.filters ? summarizeFilters(opts.filters) : undefined,
    sort: opts.sort ? summarizeSort(opts.sort) : undefined,
    ...opts.meta,
  }

  let links: HateoasLink[] = []

  if (config.includeHateoas && opts.baseUrl) {
    if (opts.pagination) {
      if (opts.pagination.type === "cursor") {
        // Extract extra query params from sort/filters for link preservation
        const extraParams = buildExtraParamsFromSortAndFilters(opts.sort, opts.filters)
        links = buildCursorPaginationLinks(opts.baseUrl, opts.pagination, extraParams)
      } else {
        const extraParams = buildExtraParamsFromSortAndFilters(opts.sort, opts.filters)
        links = buildOffsetPaginationLinks(opts.baseUrl, opts.pagination, extraParams)
      }
    } else {
      // No pagination — just a self link
      links.push({ rel: "self", href: opts.baseUrl, method: "GET" })
    }
  }

  if (opts.extraLinks) {
    links = [...links, ...opts.extraLinks]
  }

  return {
    success: true,
    data: items,
    error: null,
    meta,
    links,
  }
}

/**
 * Build extra query params from sort and filters for preserving state in links.
 */
function buildExtraParamsFromSortAndFilters(
  sort?: SortSpec[],
  filters?: FilterParams,
): Record<string, string> {
  const params: Record<string, string> = {}

  if (sort && sort.length > 0) {
    params.sort = sort
      .map((s) => `${s.field}:${s.direction}`)
      .join(",")
  }

  if (filters && filters.conditions.length > 0) {
    const serializeFilterValue = (v: unknown): string => {
      if (Array.isArray(v)) return v.map(String).join(",")
      return String(v)
    }

    const walk = (clauses: FilterClause[]) => {
      for (const clause of clauses) {
        if ("combinator" in clause) {
          walk(clause.conditions)
        } else {
          const key = `filter[${clause.field}:${clause.operator}]`
          params[key] = serializeFilterValue(clause.value)
        }
      }
    }

    walk(filters.conditions)
  }

  return params
}

// ---------------------------------------------------------------------------
// Response Envelope — Error Builder
// ---------------------------------------------------------------------------

/**
 * Build a standardized error response envelope.
 *
 * Delegates to error-handler.ts for the actual error serialization,
 * then wraps it in our standard envelope with HATEOAS links and meta.
 *
 * @param err  — the error to serialize
 * @param ctx  — optional request context (requestId, path, method, locale)
 * @returns ApiErrorResponse
 */
export function buildApiErrorResponse(
  err: unknown,
  ctx?: {
    requestId?: string
    path?: string
    method?: string
    locale?: string
  },
): ApiErrorResponse {
  const config = getConfig()
  const coreResponse: ErrorResponse = buildCoreErrorResponse(err, ctx)

  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    requestId: ctx?.requestId ?? coreResponse.body.requestId,
    version: config.responseVersion,
  }

  const links: HateoasLink[] = []

  // Add a link back to the API docs / base for error recovery
  if (config.includeHateoas) {
    links.push({
      rel: "help",
      href: "/api",
      method: "GET",
      title: "API root",
    })
  }

  return {
    success: false,
    data: null,
    error: coreResponse.body.error,
    meta,
    links,
  }
}

// ---------------------------------------------------------------------------
// Response Envelope — Generic Builder
// ---------------------------------------------------------------------------

/**
 * Unified builder that returns either a success or error response envelope
 * based on the result. Useful for try/catch patterns in API routes.
 *
 * @param result — either the data (success) or an AppError / Error (error)
 * @param opts   — context for both success and error paths
 * @returns ApiResponse<T>
 *
 * @example
 *   export async function GET(req: NextRequest) {
 *     const result = await userService.getById(id);
 *     const response = buildApiResponse(result, {
 *       onSuccess: (data) => ({ links: [selfLink(`/api/users/${data.id}`)] }),
 *       requestId: req.headers.get("x-request-id") ?? undefined,
 *     });
 *     return NextResponse.json(response, { status: response.success ? 200 : response.error.statusCode });
 *   }
 */
export function buildApiResponse<T>(
  result: T | AppError | Error,
  opts?: {
    requestId?: string
    path?: string
    method?: string
    locale?: string
    onSuccess?: (data: T) => BuildSuccessOptions
  },
): ApiResponse<T> {
  if (result instanceof AppError || result instanceof Error) {
    return buildApiErrorResponse(result, {
      requestId: opts?.requestId,
      path: opts?.path,
      method: opts?.method,
      locale: opts?.locale,
    })
  }

  const successOpts = opts?.onSuccess ? opts.onSuccess(result as T) : {}
  return buildSuccessResponse(result as T, {
    requestId: opts?.requestId,
    ...successOpts,
  })
}

// ---------------------------------------------------------------------------
// Request Parsing — Unified Helper
// ---------------------------------------------------------------------------

/**
 * Parsed query parameters from a request, ready to pass to service methods.
 */
export interface ParsedListParams {
  pagination: PaginationParams
  filters: FilterParams
  sort: SortSpec[]
  fields: FieldProjection
}

/**
 * Parse all standard list query parameters in one call.
 *
 * This is the recommended entry point for collection endpoints.
 *
 * @param searchParams     — URLSearchParams from the request
 * @param allowedFilters   — which fields can be filtered and how
 * @param allowedSortFields — which fields can be sorted
 * @param options          — overrides for defaults
 * @returns ParsedListParams
 *
 * @example
 *   const params = parseListParams(
 *     req.nextUrl.searchParams,
 *     [
 *       { field: "status", operators: ["eq", "in"] },
 *       { field: "createdAt", operators: ["gte", "lte", "between"], type: "date" },
 *       { field: "name", operators: ["eq", "like"] },
 *     ],
 *     ["id", "name", "createdAt", "status"],
 *     { defaultSort: [{ field: "createdAt", direction: "desc" }] },
 *   )
 */
export function parseListParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  allowedFilters: AllowedFilter[],
  allowedSortFields: string[],
  options?: {
    defaultSort?: SortSpec[]
    defaultLimit?: number
    filterCombinator?: "and" | "or"
  },
): ParsedListParams {
  return {
    pagination: parsePagination(searchParams),
    filters: parseFilters(searchParams, allowedFilters, options?.filterCombinator ?? "and"),
    sort: parseSort(searchParams, allowedSortFields, options?.defaultSort),
    fields: parseFieldProjection(searchParams),
  }
}

// ---------------------------------------------------------------------------
// HTTP Status to Success Mapping
// ---------------------------------------------------------------------------

/**
 * Map an HTTP method and outcome to the appropriate success status code.
 *
 * GET    → 200 OK
 * POST   → 201 Created
 * PUT    → 200 OK
 * PATCH  → 200 OK
 * DELETE → 200 OK (with deleted resource or 204 No Content)
 */
export function successStatusCode(method: string, isCreated: boolean = false): number {
  if (method.toUpperCase() === "POST" && isCreated) return 201
  return 200
}

// ---------------------------------------------------------------------------
// Convenience — 204 No Content Response
// ---------------------------------------------------------------------------

/**
 * Build a 204 No Content success response (no body).
 * For DELETE operations or any endpoint that has nothing to return.
 */
export function buildNoContentResponse(): ApiSuccessResponse<null> {
  const config = getConfig()

  return {
    success: true,
    data: null,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      version: config.responseVersion,
    },
    links: [],
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that the API response module is operational.
 */
export function pingApiResponse(): {
  healthy: boolean
  config: ApiResponseConfig
  error?: string
} {
  try {
    const config = getConfig()

    // Test success response
    const successResp = buildSuccessResponse({ test: true })
    if (!successResp.success || successResp.data === null) {
      return { healthy: false, config, error: "Success response builder failed" }
    }

    // Test collection response
    const collectionResp = buildCollectionResponse([{ id: "1" }], {
      pagination: buildOffsetPagination(0, 1, 1),
      baseUrl: "/api/test",
    })
    if (!collectionResp.success || !Array.isArray(collectionResp.data)) {
      return { healthy: false, config, error: "Collection response builder failed" }
    }

    // Test error response
    const errResp = buildApiErrorResponse(
      new AppError(ErrorCode.INTERNAL_SERVER_ERROR, { message: "health-check" }),
    )
    if (errResp.success !== false || errResp.error === null) {
      return { healthy: false, config, error: "Error response builder failed" }
    }

    // Test filter parsing
    const filters = parseFilters(
      new URLSearchParams("filter[status]=active&filter[price:gte]=10"),
      [
        { field: "status", operators: ["eq", "in"] },
        { field: "price", operators: ["gte", "lte"], type: "number" },
      ],
    )
    if (filters.conditions.length !== 2) {
      return { healthy: false, config, error: "Filter parser failed" }
    }

    // Test sort parsing
    const sort = parseSort(
      new URLSearchParams("sort=-createdAt,name"),
      ["createdAt", "name", "status"],
    )
    if (sort.length !== 2) {
      return { healthy: false, config, error: "Sort parser failed" }
    }

    return { healthy: true, config }
  } catch (err) {
    return {
      healthy: false,
      config: buildConfig(),
      error: err instanceof Error ? err.message : "Unknown API response health check error.",
    }
  }
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const apiResponse = {
  // Response builders
  buildSuccess: buildSuccessResponse,
  buildCollection: buildCollectionResponse,
  buildError: buildApiErrorResponse,
  buildResponse: buildApiResponse,
  buildNoContent: buildNoContentResponse,

  // Pagination
  parsePagination,
  parseCursorPagination,
  buildOffsetPagination,
  buildCursorPagination,
  buildOffsetPaginationLinks,
  buildCursorPaginationLinks,

  // Filtering
  parseFilters,
  filterCondition,
  andFilter,
  orFilter,
  summarizeFilters,
  filtersToPrismaWhere,

  // Sorting
  parseSort,
  sortSpec,
  summarizeSort,
  sortToPrismaOrderBy,

  // Field projection
  parseFieldProjection,

  // Unified parsing
  parseListParams,

  // HATEOAS links
  selfLink,
  collectionLink,
  createLink,
  updateLink,
  deleteLink,
  relatedLink,

  // Utilities
  successStatusCode,

  // Config
  getConfig: getConfig,
  reloadConfig: reloadApiResponseConfig,

  // Health
  ping: pingApiResponse,

  // Re-exports from error-handler (convenience)
  ErrorCode,
  AppError,
} as const

export default apiResponse