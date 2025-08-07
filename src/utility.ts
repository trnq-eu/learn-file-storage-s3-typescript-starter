import { spawn } from 'bun';
import { type ApiConfig } from "./config";




type FfprobeOutput = {
    streams: Array<{
        width: number;
        height: number;
    }>;
};

/**
 * Determines the aspect ratio category of a video file using ffprobe.
 * Returns 'landscape' (16:9), 'portrait' (9:16), or 'other'.
 */

export async function getVideoAspectRatio(filePath: string): Promise<string>{
    // Build the ffprobe command
    const args = [
        '-v', 'error', //Only shows errors
        '-select_streams', 'v:0', // Select only the first video stream
        '-show_entries', "stream=width,height", // extracts width and height
        '-of', 'json', // Ouput as JSON
        filePath // Input file
    ];

    // Run ffprobe using Bun.spawn
    const proc = spawn({
        cmd: ['ffprobe', ...args],
        stdout: 'pipe', // Capture stdout
        stderr: 'pipe' // Capture stderr
    });

    // Read stdout and stderr as text

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    const result = await proc.exited;

    // Check errors
    if (result !== 0) {
        throw new Error(`ffprobe error: ${stderr}`);
    }

    // Parse JSON output
    let data: FfprobeOutput;
    try {
        data = JSON.parse(stdout);
    } catch (err) {
        throw new Error(`Invalid JSON from ffprobe: ${err instanceof Error ? err.message : err}`);
    }

    // Make sure we have a valid video stream
    const stream = data.streams[0];
    if (!stream || stream.width == null || stream.height == null) {
        throw new Error('No video stream found or missing width/height');
    }

    const { width, height } = stream;

    console.log(`Video size: ${width}x${height}`);

    // Avoid division by zero
    if (width === 0 || height === 0) {
        return 'other';
    }

    const ratio = width / height;
    const landscapeRatio = 16 / 9;
    const portraitRatio = 9 / 16;
    const TOLERANCE = 0.02; // Accept 2% error

    if (Math.abs(ratio - landscapeRatio) < TOLERANCE) {
        return "landscape";
    } else if (Math.abs(ratio - portraitRatio) < TOLERANCE) {
        return "portrait";
    } else {
        return "other";
    }

}

