/**
 * frontend-postman/postman-types.ts
 *
 * TypeScript types for the Postman Collection v2.1 JSON format.
 * These are ONLY used within the frontend-postman package.
 * They must never leak past the frontend boundary.
 *
 * Reference: https://schema.getpostman.com/json/collection/v2.1.0/collection.json
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface PostmanAuthParam {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanAuth {
  type: 'bearer' | 'apikey' | 'oauth2' | 'basic' | 'noauth' | string;
  bearer?: PostmanAuthParam[];
  apikey?: PostmanAuthParam[];
  oauth2?: PostmanAuthParam[];
  basic?: PostmanAuthParam[];
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | string[];
  query?: Array<{
    key: string;
    value: string;
    disabled?: boolean;
    description?: string;
  }>;
  variable?: Array<{
    key: string;
    value: string;
    description?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export interface PostmanBodyUrlencoded {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanBodyFormdata {
  key: string;
  value?: string;
  src?: string;
  type: 'text' | 'file';
  disabled?: boolean;
  description?: string;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql' | 'none';
  raw?: string;
  urlencoded?: PostmanBodyUrlencoded[];
  formdata?: PostmanBodyFormdata[];
  file?: { src: string };
  graphql?: { query: string; variables?: string };
  options?: {
    raw?: { language?: string };
  };
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface PostmanRequest {
  method?: string;
  header?: PostmanHeader[] | string;
  body?: PostmanBody;
  url?: PostmanUrl | string;
  auth?: PostmanAuth;
  description?: string;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export interface PostmanResponse {
  name?: string;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
  originalRequest?: PostmanRequest;
}

// ---------------------------------------------------------------------------
// Events (pre-request / test scripts)
// ---------------------------------------------------------------------------

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script?: {
    type?: string;
    exec?: string[];
  };
}

// ---------------------------------------------------------------------------
// Items (requests and folders)
// ---------------------------------------------------------------------------

/** A leaf item — an actual API request. */
export interface PostmanRequestItem {
  name: string;
  request: PostmanRequest;
  response?: PostmanResponse[];
  event?: PostmanEvent[];
  /** vendor extensions */
  [key: string]: unknown;
}

/** A folder item — contains nested items (requests or more folders). */
export interface PostmanFolderItem {
  name: string;
  item: PostmanItem[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
  description?: string;
  /** vendor extensions */
  [key: string]: unknown;
}

export type PostmanItem = PostmanRequestItem | PostmanFolderItem;

/** Type guard: is this item a folder (has nested items)? */
export function isFolder(item: PostmanItem): item is PostmanFolderItem {
  return Array.isArray((item as PostmanFolderItem).item);
}

/** Type guard: is this item a request (has a request field)? */
export function isRequest(item: PostmanItem): item is PostmanRequestItem {
  return typeof (item as PostmanRequestItem).request === 'object' &&
    (item as PostmanRequestItem).request !== null;
}

// ---------------------------------------------------------------------------
// Top-level Collection
// ---------------------------------------------------------------------------

export interface PostmanCollectionInfo {
  _postman_id?: string;
  name: string;
  schema: string;
  description?: string;
  _exporter_id?: string;
  _collection_link?: string;
}

export interface PostmanCollection {
  info: PostmanCollectionInfo;
  item: PostmanItem[];
  auth?: PostmanAuth;
  event?: PostmanEvent[];
  variable?: Array<{
    key: string;
    value: string;
    type?: string;
    disabled?: boolean;
  }>;
}
