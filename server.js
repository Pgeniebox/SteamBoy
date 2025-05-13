const express = require.main.require('express');
const app = express();
const path = require.main.require('path');
const fs = require.main.require('fs');
const http = require.main.require('http');
const cheerio = require.main.require('cheerio');
const os = require.main.require('os');
const puppeteer = require.main.require('puppeteer');
const cors = require.main.require('cors');
const { exec } = require.main.require('child_process');
const WebSocket = require.main.require('ws');


const { existsSync, mkdir, mkdirSync, writeFile, readFile } = fs;
const { json } = express;





const userHomeDir = os.homedir();

const storageDirectory = 'C:/database/';
if (!existsSync(storageDirectory)) {
  mkdirSync(storageDirectory, { recursive: true });
}



let steamPath;
let chromePath;

async function getSystemChromePath() {
  chromePath = await new Promise((resolve, reject) => {
    const regKey = 'HKCR\\ChromeHTML\\shell\\open\\command';
    exec(`reg query "${regKey}" /ve`, (error, stdout) => {
      if (error || !stdout) return reject(new Error('Failed to locate Chrome in registry'));
      const match = stdout.match(/"([^"]*chrome\.exe)"/i);
      if (match && match[1]) return resolve(match[1]);
      reject(new Error('chrome.exe path not found in registry'));
    });
  });
}

async function getSteamPath() {
  d = await new Promise((resolve, reject) => {
    const regKey = 'HKCR\\steam\\Shell\\Open\\Command';
    exec(`reg query "${regKey}" /ve`, (error, stdout) => {
      if (error || !stdout) return reject(new Error('Failed to locate Steam in registry'));
      const match = stdout.match(/"([^"]*steam\.exe)"/i);
      if (match && match[1]) return resolve(match[1]);
      reject(new Error('steam.exe path not found in registry'));
    });
  });
  return d;
}

async function getPaths() {
  await getSystemChromePath();
  steamPath = await getSteamPath();
  steamPath = steamPath.replace(/\\steam\.exe\\?/, '\\');
  console.log('Chrome Path:', chromePath);
  console.log('Steam Path:', steamPath);
}

getPaths();



app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(json());

let clients = {};

app.get('/achievements',async (req, res) => {
  const { appid } = req.query;

  if (!appid) {
    return res.status(400).send('appid query parameter is required');
  }

  const r = await fetchAchievements(appid);

  res.json(r);
});

app.get('/NSGM', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/patch',()=>{
  const steamP = path.join(steamPath, 'steamui');
    const index = path.join(steamP, `index.html`);
   
});

app.get('/startup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'startup.html'));
});
app.get('/setup', (req, res) => {
  const { appid, dir, appname, profileID } = req.query;
  
  if (!appid || !dir || !appname || !profileID) {
    return res.status(400).send('appid, dir, appname, and profileID query parameters are required');
  }
 
  try {
    // Remove surrounding quotes if they exist
    gamePath = dir.replace(/^"|"$/g, '');
console.log(gamePath);
    // Extract directory path (e.g., E:\Games\Blasphemous 2\)
    let gameDir = path.dirname(gamePath);
    
    // Build full path to appid.txt
    const txtFilePath = path.join(gameDir, 'steam_appid.txt');
console.log(txtFilePath);
    // Write appid to appid.txt
    fs.writeFileSync(txtFilePath, appid);
    const steamP = path.join(steamPath, 'steamapps');
    const appManifestFile = path.join(steamP, `appmanifest_${appid}.acf`);
  
    // Size will be set to 0 as per your request
    const sizeOnDisk = 1000000000;
  
    // Prepare content for the appmanifest file
    const manifestContent = `
  "AppState"
  {
      "appid"           "${appid}"
      "Universe"        "1"
      "LauncherPath"    "E:\\Program Files (x86)\\Steam\\steam.exe"
      "name"            "${appname}"
      "StateFlags"      "4"
      "installdir"      "${gameDir.replace(/\\/g, '\\\\')}"
      "LastUpdated"     "0"
      "LastPlayed"      "0"
      "SizeOnDisk"      "${sizeOnDisk}"
      "StagingSize"     "0"
      "buildid"         "0"
      "LastOwner"       "${profileID}"
      "DownloadType"    "1"
      "UpdateResult"    "0"
      "BytesToDownload" "0"
      "BytesDownloaded" "0"
      "BytesToStage"    "0"
      "BytesStaged"     "0"
      "TargetBuildID"   "0"
      "AutoUpdateBehavior"   "2"
      "AllowOtherDownloadsWhileRunning" "0"
      "ScheduledAutoUpdate" "0"
      "FullValidateAfterNextUpdate" "1"
      "InstalledDepots"
      {
      }
      "SharedDepots"
      {
      }
      "UserConfig"
      {
          "language"    "english"
      }
      "MountedConfig"
      {
          "language"    "english"
      }
  }
  `;
  
    // Write the appmanifest file
    fs.writeFile(appManifestFile, manifestContent, (err) => {
      if (err) {
        console.error("Failed to write manifest file:", err);
        return res.status(500).send('Failed to create appmanifest file');
      }
  
      console.log(`Manifest created for appid: ${appid}`);
      res.send(`${appname} is installed!`);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to create appid.txt or appmanifest file');
  }
});
let lres=null;
app.get('/uninstall', async(req, res) => {
  const { appid, dir, appname,uninstalled} = req.query;
  if(uninstalled){
if(uninstalled === 'notfound') return lres.send('Game not found!');
if(uninstalled === '1') return lres.send(`uninstalled successfully!`);
    return lres.send(uninstalled);
  }

   if (!appid || !dir || !appname) {
    return res.status(400).send('appid, dir, appname, and profileID query parameters are required');}
  lres=res;
    try {
    gamePath = dir.replace(/^"|"$/g, '');
    // Extract directory path (e.g., E:\Games\Blasphemous 2\)
    const gameDir = path.dirname(gamePath);

    // Build full path to appid.txt
    const txtFilePath = path.join(gameDir, 'steam_appid.txt');

    // Write appid to appid.txt
    if (fs.existsSync(txtFilePath)) {
      fs.unlinkSync(txtFilePath);
    }
        const steamP = path.join(steamPath, 'steamapps');
    const appManifestFile = path.join(steamP, `appmanifest_${appid}.acf`);
    if (fs.existsSync(appManifestFile)) {
      fs.unlinkSync(appManifestFile);
    }
    console.log(`Manifest deleted for appid: ${appid}`);
    clients?.steam?.send(JSON.stringify({ cb:`uninstallGame(${appid});`}));
  } catch (err) {
    res.status(500).send(`Failed to delete appid.txt or appmanifest file\nError: ${err.message}`);
  }

});

//app.listen(3000, () => console.log('Server running on http://localhost:3000'));


const server = http.createServer(app);
server.listen(3005, '0.0.0.0', () => {
  console.log('✅ Server started on http://localhost:3000');
});

server.on('error', (err) => {
  console.error('❌ Server failed to start on port 3000:', err);
});









async function fetchAchievements(appid, retryCount = 3) {
  try {
    const url = `https://steamdb.info/app/${appid}/stats/`;
    
    const browser = await puppeteer.launch({
      headless: 'new', // 'new' for headless mode, or true for full headless
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36');
    await page.setJavaScriptEnabled(true);
    
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    const contentType = response.headers()['content-type'];
    
    if (!contentType.includes('html')) {
      throw new Error('The page did not return HTML content.');
    }

    // Wait for the .achievements_list to ensure the content is fully loaded
    await page.waitForSelector('.achievements_list');  

    const html = await page.content();
    const $ = cheerio.load(html);
    const bag = { rgAchievements: [] };

    // Close the browser after scraping is done
    await browser.close();

    $('.achievements_list .achievement').each((_, el) => {
      const $el = $(el);
      const percent = parseFloat($el.find('.achievement_unlock').text().replace('%', '')) || 0;
      const desc = $el.find('.achievement_desc').text().replace('Hidden achievement: ', '').trim();
      const name = $el.find('.achievement_name').text().trim();
      const id = $el.find('.achievement_api').text().trim();
      const imageName = $el.find('.achievement_image').attr('data-name');

      bag.rgAchievements.push({
        bAchieved: false,
        bHidden: false,
        flAchieved: percent,
        flCurrentProgress: 0,
        flMaxProgress: 100,
        flMinProgress: 0,
        rtUnlocked: 0,
        strDescription: desc,
        strID: id,
        strImage: `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appid}/${imageName}`,
        strName: name
      });
    });

    if (bag.rgAchievements.length > 0) {
      return bag;
    } else {
      // Retry logic with limit
      if (retryCount > 0) {
        console.log(`No achievements found, retrying... (${retryCount} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // wait before retrying
        return await fetchAchievements(appid, retryCount - 1); // retry with reduced count
      } else {
        throw new Error('No achievements found after multiple retries');
      }
    }
  } catch (err) {
    console.error('Failed to fetch or parse:', err.message);
    return null; // Return null or handle error appropriately
  }
}



const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('Client connected');
  
  ws.on('message', function incoming(message) {
    const m = JSON.parse(message);

    if(m.c){console.log(m.c);
    if(m.c === 'steam') {clients.steam=ws;
      ws.on('close', (code, reason) => {
stopServer();
      });
      
      return;}
    if(m.c === 'nsgm') {clients.nsgm=ws;return;}
    if(m.c === 'kill') {stopServer();}
  }
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(m));
      }
    });
    delete m;
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

wss.on('error', (error) => {
  console.error('WebSocket error:', error);
});


/*
const url = 'http://localhost:3000/startup';
exec(`start ${url}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});
*/

function stopServer() {
 
  try {
    process.kill(process.pid);
    console.log(`Server with PID ${process.pid} stopped.`);
  } catch (err) {
    console.error('Failed to stop server:', err.message);
  }
}

