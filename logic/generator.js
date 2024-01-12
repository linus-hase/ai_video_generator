'use strict';

const fs = require('fs');
const util = require('util');
const OpenAI = require("openai");
const textToSpeech = require('@google-cloud/text-to-speech');
require('dotenv').config();
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const readline = require('readline');
const mm = require('music-metadata');

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
    return new Promise((resolve) => {
        rl.question("\nEnter the name of the video > ", (title) => {
            videoTitle = title;
            rl.question('Do you want AI to generate content? (yes/no) > ', (option) => {
                if (option === 'yes') {
                    rl.question("\nEnter the theme of the video > ", async (theme) => {
                        const response = await openai.chat.completions.create({
                            model:"gpt-3.5-turbo-1106",
                            response_format:{ "type": "json_object" },
                            messages:[
                                {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
                                {"role": "user", "content": theme}
                            ],
                    });

                    console.log(response.choices[0].message.content);

                        rl.question('\nIs this fine? (yes/no) > ', (yesNo) => {
                            if (yesNo === 'yes') {
                                resolve(response.choices[0].message.content);
                            } else {
                                rl.question('\nEnter > ', (content) => {
                                    resolve(content);
                                });
                            }
                        });
                    });
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
    if (!fs.existsSync('generated')) {
        fs.mkdirSync('generated');
    }

    // Generate speech (Using Google Cloud Text-to-Speech API)
    const request = {
        input: { text: content },
        voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await textToSpeechClient.synthesizeSpeech(request);
    fs.writeFileSync('generated/speech.mp3', response.audioContent, 'binary');
    console.log('Speech saved to generated/speech.mp3');

    // Randomly select gameplay footage
    const gp = Math.floor(Math.random() * 2) + 1;
    const start_point = Math.floor(Math.random() * 480);
    const audio_clip = './generated/speech.mp3';
    const audio_length = await mm.parseFile(audio_clip);

    // Video editing using ffmpeg-fluent
    ffmpeg(`./logic/gameplay/gameplay_1.mp4`)
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
        .save(`generated/${videoTitle}.mp4`)
        .on('end', () => {
            console.log('Video has been created.');
        });
}

generateVideo().then(() => {
    rl.close();
});