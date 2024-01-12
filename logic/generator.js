'use strict';

require('dotenv').config();
const fs = require('fs');
const openai = require('openai-api');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const ffmpeg = require('fluent-ffmpeg');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const OPENAI_API_KEY = process.env.OPENAI_API;
const openaiClient = new openai(OPENAI_API_KEY);
const textToSpeechClient = new TextToSpeechClient();

async function getVideoContent() {
    return new Promise((resolve) => {
        rl.question("\nEnter the name of the video > ", (title) => {
            rl.question('Do you want AI to generate content? (yes/no) > ', (option) => {
                if (option === 'yes') {
                    rl.question("\nEnter the theme of the video > ", async (theme) => {
                        const response = await openaiClient.chat.completions.create({
                            engine: 'davinci',
                            prompt: `Generate content on - "${theme}"`,
                            temperature: 0.7,
                            max_tokens: 200,
                            top_p: 1,
                            frequency_penalty: 0,
                            presence_penalty: 0
                        });

                        console.log(response.data.choices[0].text);

                        rl.question('\nIs this fine? (yes/no) > ', (yesNo) => {
                            if (yesNo === 'yes') {
                                resolve(response.data.choices[0].text);
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
    const audio_clip = 'generated/speech.mp3';

    // Video editing using ffmpeg-fluent
    ffmpeg(`gameplay/gameplay_${gp}.mp4`)
        .input(audio_clip)
        .setStartTime(start_point)
        .duration(58) // set duration to 58 seconds or adjust as needed
        .outputOptions('-aspect 9:16') // Set aspect ratio to 9:16
        .save(`generated/${title}.mp4`)
        .on('end', () => {
            console.log('Video has been created.');
        });
}

generateVideo().then(() => {
    rl.close();
});
