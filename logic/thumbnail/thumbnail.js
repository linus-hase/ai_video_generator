'use strict';

const Jimp = require('jimp');

async function createThumbnail(text, inputPath) {
    const image = await Jimp.read(inputPath);

    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

    function wrapText(context, text, maxWidth) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = Jimp.measureText(font, currentLine + " " + word);
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    const maxWidth = image.bitmap.width - 300; // Adjust margin as needed
    const wrappedText = wrapText(image, text, maxWidth);

    let textHeight = 0;
    wrappedText.forEach(line => {
        textHeight += Jimp.measureTextHeight(font, line, maxWidth);
    });

    let y = (image.bitmap.height - textHeight) / 2; 

    wrappedText.forEach(line => {
        const textWidth = Jimp.measureText(font, line);
        const x = (image.bitmap.width - textWidth) / 2;
        image.print(font, x, y, line);
        y += Jimp.measureTextHeight(font, line, maxWidth);
    });

    const tempImagePath = './reddit_comment.png';
    await image.writeAsync(tempImagePath);
}

const gp = Math.floor(Math.random() * 8) + 1;
createThumbnail('Titel wird hier eingesetzt!', `./logic/thumbnail/sources/reddit_comment_template_${gp}.png`);

module.exports = {
    createThumbnail
}