const lyricsCache = {};
const metadataCache = {};

const youtubedomains = ["youtube.com", "www.youtube.com", "music.youtube.com", "m.youtube.com"]
const youtubepaths = ["/watch", "/playlist"]

function toSeconds(t) {
    const [m, rest] = t.split(":");
    return Number(m) * 60 + Number(rest);
}

function secondsToMinsAndSeconds(seconds) {
  millis = seconds * 1000
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}


const db = new Dexie("comfyvibes")

db.version(1).stores({
    playlists: '++id, plsid'
})

function displayNotification(text) {
    document.querySelector(".tv .notification").innerText = text
    document.querySelector(".tv .notification").classList.add("visible")
    setTimeout(() => { document.querySelector(".tv .notification").classList.remove("visible") }, 5000)
}

window.onerror = displayNotification
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

function onYouTubeIframeAPIReady() {
    window.player = new YT.Player('player', {
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'rel': 0,
            'modestbranding': 1,
            'origin': window.location.origin,
            'widget_referrer': window.location.href,
            'enablejsapi': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onStateChange
        }
    });
}

function onPPause() {
    document.querySelector(".pholder").classList.add("paused")
}
function onPPlay() {
    document.querySelector(".loader").classList.remove("loading")
    document.querySelector(".pholder").classList.remove("paused")
    if (document.querySelector(".notplayed")) {
        document.querySelector(".notplayed").remove()
    }
}
function onPlayerReady(event) {
    window.player = event.target;
    window.player.setShuffle(true);
    window.player.setLoop(true);
    window.player.playVideo(); // attempt autoplay
    setInterval(() => {
        Array.from(document.querySelectorAll(".prog")).forEach(prog => {
            if ([1, 2].includes(player.getPlayerState())) {
                prog.setAttribute("min", 0)
                prog.setAttribute("max", player.getDuration())
                prog.setAttribute("value", player.getCurrentTime())
                document.querySelector("span.timeview").innerText = `${secondsToMinsAndSeconds(player.getCurrentTime())} / ${secondsToMinsAndSeconds(player.getDuration())}`
            }
            else {
                prog.removeAttribute("min")
                prog.removeAttribute("max")
                prog.removeAttribute("value")
            }
        })

    }, 500)
}
function onPlayerError(event) {
    console.log(event)
    // This function will be called if an error occurs
    const errorCode = event.data;

    if (errorCode === 101 || errorCode === 150) {
        console.log("Error: This video cannot be played in an embedded player.");
        // You can display a message to the user or take other actions
    } else {
        console.log("An unknown error occurred:", errorCode);
    }
}
let lastPlayerState = null;
let stateChangeTimeout = null;
function scoreMatch(player,d) {
    console.log(d)
    let score = 0
    const title = player.videoTitle.toLowerCase()
    const tn = d.trackName || d.name
    if (title.includes(tn.toLowerCase())) score += 5
    if (title.includes(d.artistName.toLowerCase())) score += 4
    if (Math.abs(player.getDuration() - d.duration) < 2) score += 6

    return score
}

function updateTitleAndArtist(title, artist) {
    Array.from(document.querySelectorAll(".data .title")).forEach(el => { el.textContent = title });
    Array.from(document.querySelectorAll(".data .artist")).forEach(el => { el.textContent = artist });
}
async function onStateChange(event) {
    const currentState = player.getPlayerState();
    if (currentState === lastPlayerState) {
        return;
    }
    lastPlayerState = currentState;
    if (stateChangeTimeout) {
        clearTimeout(stateChangeTimeout);
        stateChangeTimeout = null;
    }
    stateChangeTimeout = setTimeout(async () => {
        console.log("Player state:", currentState);
        if (currentState == 2 || currentState == 5) {
            onPPause();
        } else if (![-1, 3, 5].includes(currentState)) {
            onPPlay();
        }
        if (currentState == 1) {
            const trackId = player.getVideoData().video_id;
            window.lyrics = [];
            onPPlay();
            document.querySelector(".lyrics").style.display = "none";
            document.querySelector(".lyrics").innerText = ""
            if (metadataCache[trackId]) {
                const meta = metadataCache[trackId];
                document.body.style.setProperty('--alb', `url(https://i.ytimg.com/vi/${trackId}/maxresdefault.jpg)`);
                updateTitleAndArtist(player.videoTitle, meta.artist)
            } else {
                dUrl = new URL("https://files.novafurry.win/.ytprox.php");
                searchp = new URLSearchParams();
                searchp.set("v", trackId);
                document.body.style.setProperty('--alb', `url(https://i.ytimg.com/vi/${trackId}/maxresdefault.jpg)`);
                dUrl.search = searchp;
                data = await fetch(dUrl);
                dataEl = document.createElement("html");
                dataEl.innerHTML = await data.text();
                try {
                    const artist = dataEl.querySelector('[itemprop="author"] [itemprop="name"]').getAttribute("content").replace(" - Topic", "").trim();
                    metadataCache[trackId] = { artist };
                    updateTitleAndArtist(player.videoTitle, artist)
                } catch (e) { console.log(e); }
            }
            if (lyricsCache[trackId]) {
                window.lyrics = lyricsCache[trackId];
                if (window.lyrics.length > 0) {
                    document.querySelector(".lyrics").style.display = "inline-block";
                    startSync();
                }
                currentIndex = 0;
            } else {
                lrcLibUrl = new URL("https://lrclib.net/api/search");
                lrcLibSearch = new URLSearchParams();
                lrcLibSearch.set("q", player.videoTitle);
                lrcLibUrl.search = lrcLibSearch;
                window.lrclibData = await (await fetch(lrcLibUrl)).json();
                lrcIndex = -1;
                foundResult = false;
                let bestIndex = -1;
                let bestScore = -1;
                results = window.lrclibData;
                for (let i = 0; i < results.length; i++) {
                    const s = scoreMatch(player, results[i]);
                    if (s > bestScore) {
                        bestScore = s;
                        bestIndex = i;
                    }
                }
                if (bestScore > 4) {
                    lrcIndex = bestIndex;
                    foundResult = true;
                }
                if (!foundResult && lrcIndex == -1) { return 0; }
                window.lyrics = [];
                if (window.lrclibData[bestIndex].syncedLyrics.length > 0) {
                    window.lrclibData[lrcIndex].syncedLyrics.split("\n").forEach((lyr) => {
                        let [stamp, ...textParts] = lyr.split(" ");
                        let text = textParts.join(" ");
                        stamp = toSeconds(stamp.replace("[", "").replace("]", ""));
                        window.lyrics.push({ time: stamp, lyric: text });
                    });
                    lyricsCache[trackId] = window.lyrics;
                    document.querySelector(".lyrics").style.display = "inline-block";
                    startSync();
                }
                currentIndex = 0;
            }
        }
        if (currentState == -1) {
            displayNotification(`Skipped "${player.videoTitle}": Could not play (embedding blocked?)`)
            player.nextVideo();
        }
    }, 100);
}

function scheduleNLyric() {
    if (currentIndex >= lyrics.length) return
    now = player.getCurrentTime()
    target = window.lyrics[currentIndex].time
    delay = (target - now)
    if (delay < 0) delay = 0
    setTimeout(() => {
        console.log(window.lyrics[currentIndex])
        document.querySelector(".lyrics").innerText = window.lyrics[currentIndex].lyric
        currentIndex += 1
        scheduleNLyric()
    }, delay * 1000)
}

function findClosestLyricTo(t) {
    let lo = 0;
    let hi = window.lyrics.length - 1;
    let ans = hi;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (window.lyrics[mid].time >= t) {
            ans = mid;
            hi = mid - 1;
        } else {
            lo = mid + 1;
        }
    }

    return ans;
}


let currentIndex = 0;

function updateLyrics() {
    const t = player.getCurrentTime();
    while (currentIndex < window.lyrics.length && t >= window.lyrics[currentIndex].time) {
        document.querySelector(".lyrics").innerText = window.lyrics[currentIndex].lyric;
        currentIndex++;
    }

    requestAnimationFrame(updateLyrics);
}

function startSync() {
    currentIndex = findClosestLyricTo(player.getCurrentTime());
    updateLyrics();
}


function startSyncOld() {
    currentIndex = findClosestLyricTo(player.getCurrentTime())
    console.log("Starting at", currentIndex)
    scheduleNLyric()
}


async function addPlaylist(playlist) {
    let dbid, plsid;

    if (typeof playlist === 'object' && playlist !== null && playlist.plsid) {
        dbid = playlist.id;
        plsid = playlist.plsid;
    } else if (typeof playlist === 'string') {
        const record = await db.playlists.where('plsid').equals(playlist).last();
        if (record) {
            dbid = record.id;
            plsid = record.plsid;
        } else {
            plsid = playlist;
        }
    } else {
        console.error("addPlaylist called with invalid argument:", playlist);
        return;
    }

    const playlistId = plsid;
    console.log(playlistId)
    dUrl = new URL("https://corsproxy.io/")
    ytU = new URL("https://youtube.com/playlist")
    ytuS = new URLSearchParams()
    ytuS.set("list", playlistId)
    ytU.search = ytuS
    searchp = new URLSearchParams()
    searchp.set("url", ytU)
    dUrl.search = searchp

    d = await (await fetch(dUrl)).text()
    data = document.createElement("html")
    data.innerHTML = d
    console.log(data.querySelector("meta[property='og:image']"), data.querySelector("meta[property='og:title']"), data.querySelector("meta"))
    try {
        image = data.querySelector("meta[property='og:image']").getAttribute("content")
        title = data.querySelector("meta[property='og:title']").getAttribute("content")
        li = document.createElement("li")
        li.setAttribute("id", dbid)
        img = document.createElement("img")
        img.setAttribute("src", image)
        tit = document.createElement("span")
        tit.innerText = title
        li.appendChild(img)
        li.appendChild(tit)
        btn = document.createElement("button")
        btn.setAttribute("class", "material-symbols-outlined")
        btn.innerText = "delete"
        btn.onclick = async () => {
            document.querySelector(".loader").classList.add("loading")
            await db.playlists.delete(dbid)
            rebuildPls()
            document.querySelector(".loader").classList.remove("loading")
        }
        li.appendChild(btn)
        li.onclick = (ev) => {
            if (ev.target.tagName == "BUTTON") {
                return
            }
            document.querySelector(".loader").classList.add("loading")
            window.player.cuePlaylist({
                listType: "playlist",
                list: playlistId,
            });
            setTimeout(() => {
                window.player.cuePlaylist({
                    listType: "playlist",
                    list: playlistId,
                });
            }, 500)
            setTimeout(() => { player.playVideo(); onPPlay() }, 1000)
        }
        document.querySelector(".playlists").appendChild(li)
    } catch (e) {
        console.log(e)
        displayNotification(e)
    }

}

function remoteToggleFc(ev) {
    console.log(ev.target.tagName)
    if (ev.target.tagName !== "BUTTON" && ev.target.tagName !== "INPUT") {
        document.querySelector('.remote').classList.toggle('fcplayer')
    }
}
document.querySelector(".playerbar").addEventListener("click", remoteToggleFc)
document.querySelector(".fc").addEventListener("click", remoteToggleFc)
setInterval(() => {
    document.querySelector(".time").innerText = (new Date()).toLocaleTimeString().toUpperCase()
    document.querySelector(".date").innerText = (new Date()).toLocaleDateString().toUpperCase()

}, 1000)

async function rebuildPls() {
    document.querySelector(".playlists").innerHTML = ""
    await db.playlists.each(addPlaylist)
}

async function savepls() {
    document.querySelector(".loader").classList.add("loading")
    var failed = "Please make sure the provided URL is a YouTube playlist.\nFaliure Reason:"
    url = new URL(document.querySelector("input#plsid").value)
    if (youtubedomains.includes(url.hostname) && youtubepaths.includes(url.pathname)) {
        urlParm = new URLSearchParams(url.search)
        console.log(urlParm, urlParm.has("list"))
        if (urlParm.has("list")) {
            await db.playlists.add({ "plsid": urlParm.get("list") })
            rebuildPls()
            document.querySelector(".addPlaylist").classList.remove("visible")
        }
        else {
            failed += `\nMissing 'list' parameter (only got: ${Array.from(urlParm.keys()).join(", ")}) `
            alert(failed)
        }
    }
    else {
        if (!youtubedomains.includes(url.hostname)) {
            failed += `\nDomain (${url.hostname}) is not a recognised YouTube domain (one of:${youtubedomains.join(", ")})`
        }
        if (!youtubepaths.includes(url.pathname)) {
            failed += `\Pathname (${url.pathname}) is not a recognised YouTube pathname (one of:${youtubepaths.join(", ")})`
        }
        alert(failed)
    }
    document.querySelector(".loader").classList.remove("loading")

}

addPlaylistDiv = document.querySelector(".addPlaylist")
function tAddplaylist(ev) {
    console.log(ev.target)
    if (!addPlaylistDiv.classList.contains("visible") && (ev.target == addPlaylistDiv || addPlaylistDiv.contains(ev.target))) {
        addPlaylistDiv.classList.add("visible")
    }
    else if (!addPlaylistDiv.contains(ev.target)) {
        addPlaylistDiv.classList.remove("visible")
    }
}
document.body.addEventListener("click", tAddplaylist)
document.querySelector(".loader").classList.add("loading")
rebuildPls()
document.querySelector(".loader").classList.remove("loading")
