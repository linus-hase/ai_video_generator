'use strict';

const { createThumbnail } = require('./thumbnail/thumbnail.js');

const fs = require('fs');
const fs_extra = require('fs-extra');
const axios = require('axios');
const OpenAI = require("openai");
const textToSpeech = require('@google-cloud/text-to-speech');
require('dotenv').config();
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const readline = require('readline');
const mm = require('music-metadata');
const snoowrap = require('snoowrap');

let videoTitle = "Lorem Ipsum";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// api clients
const OPENAI_API_KEY = process.env['OPENAI_API'];
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});
const textToSpeechClient = new textToSpeech.TextToSpeechClient();

async function getVideoContent() {
    const story = await getRedditPosts();
    return new Promise((resolve) => {
        rl.question("\nEnter the name of the video > ", (title) => {
            videoTitle = title;
            rl.question('Do you want AI to generate content? (yes/no) > ', async (option) => {
                if (option === 'yes') {
                    // rl.question("\nEnter the theme of the video > ", async (theme) => {
                        const response = await openai.chat.completions.create({
                            model:"gpt-3.5-turbo-1106",
                            messages:[
                                {"role": "system", "content": "You are a helpful assistant."},
                                {"role": "user", "content": story[1]+ "\n" + "Rewrite this story as a makeover. It shouldn't sound like the original but is still written in the same narrative perspective and have about the same length and, MOST IMPORTANTLY, the transported emotions. The output should only contain the story and not any additional comments made before, in or behind the original. Please also change names of characters."}
                            ],
                        });

                        console.log(response.choices[0].message.content);

                        rl.question('\nIs this fine? (yes/no) > ', (yesNo) => {
                            if (yesNo === 'yes') {
                                const responseArr = []
                                responseArr.push(story[0])
                                responseArr.push(response.choices[0].message.content);
                                resolve(responseArr);
                            } else {
                                rl.question('\nEnter > ', (content) => {
                                    resolve(content);
                                });
                            }
                        });
                    // });
                } else {
                    rl.question('\nEnter the content of the video > ', (content) => {
                        resolve(content);
                    });
                }
            });
        });
    });
}

async function generateVideo() {
    const content = await getVideoContent();
    console.log(content[0]);
    if (!fs.existsSync('generated')) {
        fs.mkdirSync('generated');
    }
    // await getRedditPosts();

    // // Generate speech (Using Google Cloud Text-to-Speech API)
    // const request = {
    //     input: { text: content },
    //     voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
    //     audioConfig: { audioEncoding: 'MP3' },
    // };

    // const [response] = await textToSpeechClient.synthesizeSpeech(request);
    // fs.writeFileSync('generated/speech.mp3', response.audioContent, 'binary');
    // console.log('Speech saved to generated/speech.mp3');

    // Randomly select gameplay footage
    const gp = Math.floor(Math.random() * 3) + 1;
    const start_point = Math.floor(Math.random() * 480);
    const audio_clip = './generated/speech.mp3';
    const audio_length = await mm.parseFile(audio_clip);

    // generate subtitles 
    // await transcribeAudio(audio_clip);

    ffmpeg()
        .input('./generated/subtitles.srt')
        .output('./generated/subtitles.ass')
        .save('./generated/subtitles.ass');
    
    setTimeout(() =>{
        addLineBreaksToASS('./generated/subtitles.ass');

        // Video editing using ffmpeg-fluent
        ffmpeg(`./logic/gameplay/gameplay_4.mp4`)
            .setStartTime(start_point)
            .duration(audio_length.format.duration)
            .addInput(audio_clip)
            .complexFilter([
                {
                filter : 'amix', options: { inputs : 2, duration : 'longest' }
                }
            ])
            .audioCodec('aac')
            .videoCodec('libx264')
            .outputOptions("-vf ass=./generated/subtitles.ass:fontsdir=./fonts/")
            .save(`generated/${videoTitle}.mp4`)
            .on('end', () => {
                console.log('Video has been created.');
                ffmpeg('./generated/run.mp4')
                .input('./reddit_comment.png')
                .complexFilter([
                    `[0:v][1:v] overlay=x=0:y=0:enable='between(t,0,${findDuration('./generated/subtitles.srt', 'potential')})'`
                ])
                .save('output.mp4')
                .on('end', () => {
                    console.log('Processing finished!');
                }).on('error', (err) => {
                    console.error('Error:', err);
                });
            });
    }, 10000);
}

async function transcribeAudio(audio_clip) {
    const baseUrl = 'https://api.assemblyai.com/v2';

    const headers = {
        authorization: process.env.ASSEMBLYAI_API 
    };

    const audioData = await fs_extra.readFile(audio_clip);
    const uploadResponse = await axios.post(`${baseUrl}/upload`, audioData, { headers });
    const uploadUrl = uploadResponse.data.upload_url;

    const data = {
        audio_url: uploadUrl
    };
    const url = `${baseUrl}/transcript`;
    const response = await axios.post(url, data, { headers: headers }); 

    const transcriptId = response.data.id;
    const pollingEndpoint = `${baseUrl}/transcript/${transcriptId}`;

    while (true) {
        const pollingResponse = await axios.get(pollingEndpoint, {
            headers: headers
        });
        const transcriptionResult = pollingResponse.data;

        if (transcriptionResult.status === 'completed') {
            break;
        } else if (transcriptionResult.status === 'error') {
            throw new Error(`Transcription failed: ${transcriptionResult.error}`);
        } else {
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    const subtitles = await getSubtitleFile(transcriptId, headers);
    await fs_extra.writeFile('./generated/subtitles.srt', subtitles);
}

async function getSubtitleFile(transcriptId, headers) {
    const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}/srt?chars_per_caption=12`
  
    try {
      const response = await axios.get(url, { headers })
      return response.data
    } catch (error) {
      throw new Error(
        `Failed to retrieve ${'srt'.toUpperCase()} file: ${error.response
          ?.status} ${error.response?.data?.error}`
      )
    }
}

function findDuration(srtPath, searchWord) {
    const srt = fs.readFileSync(srtPath, 'utf8');
    let lines = srt.split('\n');

    for (let i = 0; i < lines.length; i++) {
        // Check if the line is a subtitle text
        if (isNaN(parseInt(lines[i])) && !lines[i].includes('-->')) {
            if (lines[i].toLowerCase().includes(searchWord.toLowerCase())) {
                // Find the timestamp line which is two lines above the subtitle text
                let timestampLine = lines[i - 1];
                return timestampLine.split(' --> ')[1].split(':')[2].split(',')[0];
            }
        }
    }
    return null;
}

function overlayImageOnVideo(imagePath, videoPath, outputPath, duration) {
    ffmpeg(videoPath)
        .input(imagePath)
        .complexFilter([
            `[0:v][1:v] overlay=shortest=1:enable='between(t,0,${duration})' [out]`
        ])
        .outputOptions([
            `-map [out]`,
            `-map 0:a?`
        ])
        .on('end', function() {
            console.log('Processing finished !');
        })
        .on('error', function(err) {
            console.log('Error: ' + err.message);
        })
        .save(outputPath);
}


function addLineBreaksToASS(assFilePath) {
    // wait on .ass transcription
    const content = fs.readFileSync(assFilePath, 'utf8');
    const lines = content.split('\n');
    const modifiedLines = lines.map(line => {
        if (line.startsWith('Dialogue:')) {
            // Split the line into components and then process the text part
            let parts = line.split(',');
            let textPart = parts.slice(9).join(','); // Join back the text part in case it contains commas
            let modifiedText = textPart.split(' ').join(' \\N');
            parts[9] = modifiedText; // Replace the text part with modified text
            return parts.join(',');
        } else if (line.startsWith('Style:')) {
            return 'Style: Default,Borsok,25,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1.5,2,5,10,10,10,1';
        } else {
            return line;
        }
    });
    const modifiedContent = modifiedLines.join('\n');
    fs.writeFileSync(assFilePath, modifiedContent, 'utf8');
}

const r = new snoowrap({
    userAgent: true,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.SNOOWRAP_REFRESH_TOKEN
});

async function getRedditPosts() {
    let story = [];
    story = await r.getTop('Stories', {time: 'week', limit: 1}).then(data => {
        const story = [];
        story.push(data[0].title);
        story.push(data[0].selftext);
        return story;
    });
    return story;
}

generateVideo().then(() => {
    rl.close();
});