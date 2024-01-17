'use strict';

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const readline = require('readline');

// helpers

function getVideoDuration(videoPath, callback) {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
            callback(err, null);
        } else {
            const duration = metadata.format.duration;
            callback(null, duration);
        }
    });
}

function calculateSegments(duration) {
    const segmentLength = 60;
    const fullSegments = Math.floor(duration / segmentLength);
    const lastSegmentLength = duration % segmentLength;
    return { fullSegments, lastSegmentLength };
}

function splitVideo(videoPath, fullSegments, lastSegmentLength) {
    for (let i = 0; i < fullSegments; i++) {
        ffmpeg(videoPath)
            .setStartTime(i * 60)
            .setDuration(60)
            .output(`output_part_${i + 1}.mp4`)
            .on('end', () => {
                console.log(`Segment ${i + 1} finished!`);
            })
            .on('error', (err) => {
                console.error('Error:', err);
            })
            .run();
    }

    if (lastSegmentLength > 0) {
        ffmpeg(videoPath)
            .setStartTime(fullSegments * 60)
            .setDuration(lastSegmentLength)
            .output(`output_part_${fullSegments + 1}.mp4`)
            .on('end', () => {
                console.log(`Last segment finished!`);
            })
            .on('error', (err) => {
                console.error('Error:', err);
            })
            .run();
    }
}

// usage

function splitVideoIntoParts(videoPath) {
    getVideoDuration(videoPath, (err, duration) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
    
        const { fullSegments, lastSegmentLength } = calculateSegments(duration);
        splitVideo(videoPath, fullSegments, lastSegmentLength);
    });
}

function deleteLines(filePath, searchWord) {
    const srt = fs.readFileSync(filePath, 'utf8');
    let lines = srt.split('\n');
    let newLines = [];
    let lineFound = false;

    for (let i = 0; i < lines.length; i++) {
        if (lineFound) {
            newLines.push(lines[i]);
        } else {
            console.log(lines[i]);
            lineFound = lines[i].includes(searchWord);
        }
    }

    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log('File updated successfully');
}

module.exports = {
    splitVideoIntoParts,
    deleteLines
}