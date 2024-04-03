const AWS_SDK = require('aws-sdk')
const express = require('express')
const cors = require('cors')
const https = require('https')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const PORT = 8000

require('dotenv').config()

const app = express()
app.use(cors())

AWS_SDK.config.update({
    region: process.env.REGION_NAME,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

const dynamoDB = new AWS_SDK.DynamoDB({apiVersion: '2012-08-10'});

const params = {
    TableName: process.env.DYNAMODB_TABLE_NAME, 
  };

  
  const BASE_URL = "https://www.basketball-reference.com/players/";

  async function fetchPlayerImageUrl(playerName) {
    // Split the player name into first and last names
    const [firstName, lastName] = playerName.split(' ');
  
    // Construct the initial part of the URL
    const urlPart = `${lastName.substring(0, 1).toLowerCase()}/${lastName.substring(0, 4).toLowerCase()}${firstName.substring(0, 2).toLowerCase()}`;
  
    // Try with '01' first
    let playerImageUrl = await attemptFetchImageUrl(`${BASE_URL}${urlPart}01.html`);
  
    // If image not found, try with '02'
    if (!playerImageUrl) {
      playerImageUrl = await attemptFetchImageUrl(`${BASE_URL}${urlPart}02.html`);
    }
  
    return playerImageUrl;
  }
  
  async function attemptFetchImageUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch page: ${response.statusText}`);
      const html = await response.text();
      const $ = cheerio.load(html);
      const imgSrc = $("#info #meta .media-item img").attr("src");
      return imgSrc || null;
    } catch (error) {
      console.error(`Error fetching image URL from ${url}:`, error);
      return null;
    }
  }
  



  
//   dynamoDB.describeTable(params, (err, data) => {
//     if (err) {
//       console.error('Error', err);
//     } else {
//       console.log('Success', data.Table);
//     }
//   });
async function getRandomItems(tableName, numberOfItems) {
    const params = {
        TableName: tableName,
    };

    try {
        const data = await dynamoDB.scan(params).promise();
        const items = data.Items;
        const randomItems = [];

        // Shuffle array and pick first N items
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        for (let i = 0; i < numberOfItems && i < items.length; i++) {
            randomItems.push(items[i]);
        }

        return randomItems;
    } catch (error) {
        console.error(error);
        return [];
    }
}

const processData = (data) => {
    return data.map(item => {
      const processedItem = {};
      Object.keys(item).forEach(key => {
        const valueObject = item[key];
        // Check if the value is of type 'N' (Number)
        if (valueObject.hasOwnProperty('N')) {
          // Convert 'N' values from string to float
          processedItem[key] = parseFloat(valueObject.N);
        } else if (valueObject.hasOwnProperty('S')) {
          // Directly assign 'S' values
          processedItem[key] = valueObject.S;
        }
        // Add more conditionals here if you have other types like 'B', 'BOOL', etc.
      });
      return processedItem;
    });
  };
  

  const sortItemsByPPGDesc = (data) => {
    return data.sort((a, b) => b.PPG - a.PPG);
};

// function checkImageExists(url) {
//   return new Promise((resolve) => {
//     // Perform a HEAD request to get headers without downloading the body
//     const req = https.request(url, { method: 'HEAD' }, (res) => {
//       resolve(res.statusCode >= 200 && res.statusCode < 300);
//     });

//     req.on('error', (error) => {
//       console.error(error);
//       resolve(false); // Resolve to false on request error (e.g., network issues)
//     });

//     req.end();
//   });
// }
// app.get('/check-img', async (req, res) => {
//   let url = 'https://www.basketball-reference.com/players/s/scalabr01.html';
//   try {
//     const src = await fetchImageSrc(url);
//     if (src) {
//       res.send({ success: true, src });
//     } else {
//       res.send({ success: false, message: 'Second image not found' });
//     }
//   } catch (error) {
//     res.status(500).send({ success: false, message: error.message });
//   }
// });

app.get('/', (req, res) => {

    const tableName = 'TopFive';
    const numberOfItems = 5;

    getRandomItems(tableName, numberOfItems).then(randomItems => {
      const processedData = processData(randomItems);
      const sortedByPPG = sortItemsByPPGDesc([...processedData]); // Create a copy and sort it
  
        res.send(
          {
            "data": processedData,
            "correct_order": sortedByPPG,
          })
})
   
})

app.listen(PORT, () => {

})