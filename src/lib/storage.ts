import { envClient } from '@/env/client';

/**
 * File storage (S3 / MinIO) is optional: without VITE_S3_BUCKET_PUBLIC_URL
 * (and the S3_* settings on the server) the upload controls are hidden and
 * avatars, logos and covers show their fallback.
 */
export const isStorageEnabled = !!envClient.VITE_S3_BUCKET_PUBLIC_URL;
