const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('Assests and Branding/Brand Guide.pdf');

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => console.error(err));
