// src/api/videoResponse.ts

import type { ApiConfig } from "../config";
import { generatePresignedURL } from "../s3";

/**
 * Converts a DB video (with videoURL = S3 key) into one with a working presigned URL.
 */
export function dbVideoToSignedVideo(cfg: ApiConfig, video: any) {
  if (!video?.videoURL) {
    throw new Error("Invalid video object: missing videoURL");
  }
  const presignedURL = generatePresignedURL(cfg, video.videoURL, 60);
  return {
    ...video,
    videoURL: presignedURL,
  };
}