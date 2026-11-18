// The @vercel/blob the api/ handlers load on Cloudflare (wrangler.jsonc aliases '@vercel/blob' here; the real package is
// 'vercel-blob-real'). Every storage call goes to the real Vercel store unless the Worker secret STORE is 'd1', then to the
// D1 database bound as STORE_DB (src/store-d1.mjs). worker.mjs imports this file before any handler, so the fetch that
// answers store URLs from D1 is in place before a handler can capture fetch.
import * as real from 'vercel-blob-real';
import { env } from 'cloudflare:workers';
import { blobApi } from './store-d1.mjs';

const api = blobApi({ real, env: () => env });
api.installFetch(globalThis);

export * from 'vercel-blob-real';
export const { put, list, del, head, get, copy, rename, putFromUrl, putImage, createFolder, createMultipartUpload, createMultipartUploader, uploadPart, completeMultipartUpload } = api;
