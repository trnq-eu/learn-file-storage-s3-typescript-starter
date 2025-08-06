import type { ApiConfig } from "./config";
import { s3, write } from "bun";


export async function uploadVideoToS3(
    cfg: ApiConfig,
    key: string,
    processesFilePath: string,
    contentType: string,
) {
    const s3file = cfg.s3Client.file(key, { bucket: cfg.s3Bucket});
    const videoFile = Bun.file(processesFilePath);
    await s3file.write(videoFile, { type: contentType });
}

export function generatePresignedURL(
    cfg: ApiConfig,
    key: string,
    expireTime: number = 60
) {
    const s3file = cfg.s3Client.file(key, { bucket: cfg.s3Bucket});
    return s3file.presign({
        expiresIn: expireTime,
    });
}