import { respondWithJSON } from "./json";
import { rm } from "fs/promises";
import path from "path";
import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, UserForbiddenError } from "./errors";
import { randomBytes } from "crypto";
import { getAssetDiskPath, getAssetURL, mediaTypeToExt } from "./assets";
import { uploadVideoToS3 } from "../s3";
import { getVideoAspectRatio } from "../utility"


// Regex to match UUID (v1-v5, standard format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30;
  const { videoId } = req.params as { videoId?: string}

  if (!videoId) {
    return respondWithJSON(400, {error: "Missing videoId parameter"});
  }

  if (!isValidUUID(videoId)) {
    return respondWithJSON(400, {error: "Invalid videoId: must be a valid UUID"});
  }

  const token = getBearerToken(req.headers)
  const userId = validateJWT(token, cfg.jwtSecret);

  const video = await getVideo(cfg.db, videoId);

  if (!video) {
    return respondWithJSON(400, "Video not found")
  }

  if (userId != video.userID) {
    throw new UserForbiddenError("User is not video owner.");
  }

  const formData = await req.formData()

  const videoFile = formData.get("video")

  if (!(videoFile instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
 }

  if (videoFile.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File exceeds size limit (1GB)")
  }

  const mediaType = videoFile.type;

  if (videoFile.type != mediaType) {
    throw new BadRequestError("Invalid file type, only MP4 is allowed");

  }

  const extension = mediaTypeToExt(mediaType)

  const tempFilePath = path.join("/tmp", `${videoId}.mp4`);
  await Bun.write(tempFilePath, videoFile);

  // get aspect ratio using ffprobe
  let aspectRatio;

  try {
    aspectRatio = await getVideoAspectRatio(tempFilePath)
    console.log("Aspect ratio detected:", aspectRatio);  // <-- Add this line

  } catch (err) {
    await rm(tempFilePath, {force: true});
    return respondWithJSON(500, { error: `Failed to analyze video: ${err instanceof Error ? err.message : 'Unknown error'}`});
  }

  // create S3 key with aspect ratio prefix
  const key = `${aspectRatio}/${videoId}.mp4`

  await uploadVideoToS3(cfg, key, tempFilePath, "video/mp4");

  // const randomVideoId = randomBytes(32).toString("base64url")

  const videoURL =  `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;

  video.videoURL = videoURL;

  await updateVideo(cfg.db, video);

  await rm(tempFilePath, { force: true });

  return respondWithJSON(200, { videoURL});
}
