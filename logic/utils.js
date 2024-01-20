'use strict';

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const readline = require('readline');

// helpers

function calculateSegments(duration) {
    console.log(duration);
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
            .output(`./final/output_part_${i + 1}.mp4`)
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
            .output(`./final/output_part_${fullSegments + 1}.mp4`)
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

function splitVideoIntoParts(totalLength, videoPath) {
    const { fullSegments, lastSegmentLength } = calculateSegments(totalLength);
    console.log(fullSegments + ' ' + lastSegmentLength);
    splitVideo(videoPath, fullSegments, lastSegmentLength);
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

function createTitle(title) {
    return title + " #shorts #fy #storytime";
}

function createDescription(description) {
    return description + " #shorts #fy #storytime\nAlso follow us on TikTok: https://www.tiktok.com/@forumfables";
}

function createTags() {
    return "reddit #short,askreddit #short,reddit stories,askreddit stories,askreddit posts,reddit story,askreddit stories #shorts,reddit stories #shorts,askreddit sus,reddit sus,viral reddit post,reddit post,askreddit comments,askreddit suspicious,reddit suspicious,reddit delight,reddit cheating stories,viral reddit,askreddit confession,askreddit,reddit confession,reddit.delight,raskreddit,shorts,reddit,stories,story,house of stories,crazy story,recipes";
}

module.exports = {
    splitVideoIntoParts,
    deleteLines,
    createTitle,
    createDescription,
    createTags
}