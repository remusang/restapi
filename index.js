const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const ytdl = require('@distube/ytdl-core');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const cheerio = require("cheerio")

const app = express();
app.set("json spaces", 2);
app.use(cors());
app.use(express.json());

const download = async(url, filename) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  const writer = fs.createWriteStream(filename);
  response.data.pipe(writer);
  writer.on('finish', () => writer.close());
};

const varHeaders = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'sec-ch-prefers-color-scheme': 'light',
    'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Microsoft Edge";v="110"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/124.0.0.0',
};

let grapHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Dnt': '1',
    'Pragma': 'no-cache',
    'Referer': '',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    'X-Csrftoken': 'EuZcvVSeiRAC60CJQRrRC6',
    'X-Ig-App-Id': '936619743392459',
    'X-Ig-Www-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest'
}

async function userGraphql(url) {
    try {
        let body = await axios.get(url, {
            headers: varHeaders,
        }).then(res => res.data)
        
        let user_id = body.match(/<meta\s+property="instapp:owner_user_id"\s+content="(\d+)"/)[1]
        let video_id = body.match(/instagram:\/\/media\?id=(\d+)/)[1]

        const graphUrl = `https://www.instagram.com/graphql/query/?doc_id=7571407972945935&variables=%7B%22id%22%3A%22${user_id}%22%2C%22include_clips_attribution_info%22%3Afalse%2C%22first%22%3A1000%7D`

        console.log('graphUrl: ', graphUrl)
        const graph = await axios.get(graphUrl, {
            method: 'GET',
            headers: grapHeaders,
            httpsAgent: httpsProxyAgent
        }).then(response => response.data)

        // Ambil video dari respons
        const edges = graph.data.user.edge_owner_to_timeline_media.edges;
        let videoData = edges.find(edge => edge.node.id === video_id);

        if (!videoData) {
            return {
                
                status: false,
                message: 'Video not found'
            };
        }

        // Memastikan bahwa videoData.node ada
        videoData = videoData.node;

        const getUrlFromData = (videoData) => {
            // Jika videoData memiliki edge_sidecar_to_children, ambil semua video URLs dari children
            if (videoData.edge_sidecar_to_children) {
                return videoData.edge_sidecar_to_children.edges
                    .map(edge => edge.node.video_url || edge.node.display_url); // Ambil video_url dari setiap video
            }
        
            // Jika tidak ada edge_sidecar_to_children, gunakan video_url dari videoData
            return videoData.video_url ? [videoData.video_url] : [ videoData.display_url ];
        };

        const listUrl = getUrlFromData(videoData)

        return {
            
            status: true,
            data: {
                url: listUrl,
                caption: videoData['edge_media_to_caption']['edges'].length > 0 ? videoData['edge_media_to_caption']['edges'][0]['node']['text'] : null,
                
                isVideo: videoData['is_video'],
            }
        };
    } catch (error) {
        return {
            creator: '@HannUniverse',
            status: false,
            message: error.message
        };
    }
}

class Pinterest {
  async getURL(Url) {
    try {
      const response = await axios.get(Url);
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      let contentUrl = '';
      let type = ""
      const video = document.querySelector('video');
      if (video) {
        const videoUrl = video.getAttribute('src');
        contentUrl = videoUrl.replace('hls', '720p').replace('.m3u8', '.mp4');
        type = "video"
      } else {
        const img = document.querySelector('meta[property="og:image"]');
        if (img) {
          contentUrl = img.getAttribute('content');
          type = "image"
        }
      }
      return { contentUrl, type };
    } catch (error) {
      console.error('Ошибка:', error.message);
      return '';
    }
  }
}

app.get("/", async(req, res) => {
  res.json({ main: { url: req.protocol + '://' + req.get('host'), services: [ "ytdl", "ttdl", "pindl", "ttdl", "igdl (MT)", "scdl", "mediafire", "autodl" ] } })
})

app.get("/autodl", async(req, res) => {
  const { url } = req.query;
  if(ytdl.validateURL(url)) {
    res.redirect(req.protocol + '://' + req.get('host') + "/ytdl?url=" + url)
  } else if(url.includes("tiktok")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/ttdl?url=" + url)
  } else if(url.includes("pinterest.com/pin")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/pindl?url=" + url)
  } else if(url.includes("videy.co/")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/videydl?url=" + url)
  } else if(url.includes("instagram")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/igdl?url=" + url)
  } else if(url.includes("m.soundcloud.com")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/scdl?url=" + url)
  } else if(url.includes("www.mediafire.com")) {
    res.redirect(req.protocol + '://' + req.get('host') + "/mediafire?url=" + url)
  } else {
    res.json({ success: false, message: "Invalid link, may auto download not support that link." })
  }
})

app.get("/ytdl", async(req, res) => {
  const { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })
  
  if (!ytdl.validateURL(url)) {
    return res.json({ success: false, message: "Invalid youtube link" });
  }

  const info = await ytdl.getInfo(url);
  const audio = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
  const video = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });

  res.json({ success: true, audio: audio.url, video: video.url });
});

app.get("/ttdl", async(req, res) => {
  const { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })

  const response = await fetch(`https://tikwm.com/api/?url=${url}`);
  const data = await response.json();

  let images = [];
  if (data.data.images && data.data.images.length > 0) {
    images = data.data.images;
  }
  
  let video = "";
  
  if(!data.data.play.includes(".mp3")) {
    let video = data.data.play;
  }
  
  res.json({ success: true, video: video || undefined, images: images.length > 0 ? images : undefined, audio: data.data.music });
});

app.get("/ngl", async(req, res) => {
  let { username, question } = req.query;
  
  if(!username) return res.json({ success: false, message: "Required parameter 'username'" })
  
  if(!question) return res.json({ success: false, message: "Required parameter 'question'" })
  
  const deviceId = () => {
    const chars = '0123456789abcdef';
    const random = (length) =>
      Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${random(8)}-${random(4)}-${random(4)}-${random(4)}-${random(12)}`;
  };

  const response = await fetch('https://ngl.link/api/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Referer': 'https://ngl.link/' + username
    },
    body: JSON.stringify({
      username: username,
      question: question,
      deviceId: deviceId(),
      gameSlug: '',
      referrer: ''
    })
  });
  
  if(response.status !== 200) {
    res.json({ success: false, message: "Ratelimit!" })
  } else {
    res.json({ success: true, message: "Success sending question to " + username + "!" })
  }
})

app.get("/pindl", async(req, res) => {
  let { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })
  
  if(!url.includes("pinterest.com/pin")) return res.json({ success: false, message: "Invalid pinterest link" })
  
  const pin = new Pinterest();
  const dl = await pin.getURL(url)
  
  res.json({ success: true, type: dl.type, url: dl.contentUrl })
  
})

app.get("/videydl", async(req, res) => {
  let { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })
  
  if(!url.includes("videy.co/")) return res.json({ success: false, message: "Invalid videy link" })
  
  var paramValue = url.split("id=")[1]
  var fileType = '.mp4' // default
  if (paramValue) {
    fileType = '.mp4';
  } else if (paramValue.length === 9 && paramValue[8] === '2') {
    fileType = '.mov';
  }
  var videoLink = 'https://cdn.videy.co/' + paramValue + fileType;
  
  res.json({ success: true, url: videoLink })
})

app.get("/igdl", async(req, res) => {

  res.json({ success: false, message: "Maintenance" })
  

  let { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })
  
  if(!url.includes("instagram")) return res.json({ success: false, message: "Invalid instagram link" })
  
  let ig = await userGraphql(url)
  
  res.json({ success: true, result: ig })
})

app.get("/scdl", async(req, res) => {
  let { url } = req.query;
  
  if(!url) return res.json({ success: false, message: "Required parameter 'url'" })
  
  if(!url.includes("m.soundcloud.com")) return res.json({ success: false, message: "Invalid soundcloud link" })
  
  const scdl = require('soundcloud-downloader').default;
  const { Catbox } = require('node-catbox');
  const CLIENT_ID = 'yLfooVZK5emWPvRLZQlSuGTO8pof6z4t';
  
  const stream = await scdl.download(url, CLIENT_ID);
  const filePath = './audio.mp3';

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    stream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const catbox = new Catbox();
  const response = await catbox.uploadFile({ path: filePath });
  
  res.json({ success: true, url: response })
  
  fs.unlinkSync(filePath);
})

app.get("/mediafire", async (req, res) => {
  let { url } = req.query;

  if (!url) return res.json({ success: false, message: "Required parameter 'url'" });

  if (!url.includes("www.mediafire.com")) return res.json({ success: false, message: "Invalid mediafire link" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const fileUrl = $("#downloadButton").attr("href");

    if (!fileUrl) return res.json({ success: false, message: "Cant find download url" });

    res.json({ success: true, url: fileUrl });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});


app.use('*', (req, res) => {
  res.redirect('/');
});


app.listen(8080);