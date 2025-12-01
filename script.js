const youtubedomains = ["youtube.com", "www.youtube.com", "music.youtube.com", "m.youtube.com"]
const youtubepaths = ["/watch", "/playlist"]
// initialise DB

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

// Load YouTube IFrame API asynchronously
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

// Called when API is ready
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
// Called when player is ready
function onPlayerReady(event) {
    window.player = event.target;
    //setTimeout(()=>{window.player.cuePlaylist("PL5Pk318UKwyKd2ehcr0qHDsqNRmdyVgAV",0,0);}, 500)
    window.player.setShuffle(true);
    window.player.setLoop(true);
    window.player.playVideo(); // attempt autoplay
    setInterval(() => {
        Array.from(document.querySelectorAll(".prog")).forEach(prog => {
            if ([1, 2].includes(player.getPlayerState())) {
                prog.setAttribute("min", 0)
                prog.setAttribute("max", player.getDuration())
                prog.setAttribute("value", player.getCurrentTime())

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
// Called on state changes
async function onStateChange(event) {
    console.log("Player state:", player.getPlayerState());
    dUrl = new URL("http://files.novafurry.win/.ytprox.php")
    searchp = new URLSearchParams()
    searchp.set("v", player.getVideoData().video_id)
    document.body.style.setProperty('--alb', `url(https://i.ytimg.com/vi/${player.getVideoData().video_id}/maxresdefault.jpg)`)
    dUrl.search = searchp
    console.log(dUrl.href, searchp)
    data = await fetch(dUrl)
    dataEl = document.createElement("html")
    dataEl.innerHTML = await data.text()
    console.log(dataEl)
    //console.log(dataEl.querySelectorAll("span"))
    //console.log(dataEl.querySelector('span[itemprop]')).getAttribute("content").replace(" - Topic", "").trim()
    try {
        Array.from(document.querySelectorAll(".data .title")).forEach(el => { el.textContent = player.videoTitle })
        Array.from(document.querySelectorAll(".data .artist")).forEach(el => { el.textContent = dataEl.querySelector('[itemprop="author"] [itemprop="name"]').getAttribute("content").replace(" - Topic", "").trim() })

    }
    catch (e) {
        console.log(e)
    }
    if (player.getPlayerState() == 2 || player.getPlayerState() == 5) {
        onPPause()
    }
    else if (![-1, 3, 5].includes(player.getPlayerState())) {
        onPPlay()
    }
    if (player.getPlayerState() == 1) {
        onPPlay()
    }
    if (player.getPlayerState() == -1) {
        document.querySelector(".tv .notification").innerText = `Skipped "${player.videoTitle}": embedding blocked by copyright holder.`
        document.querySelector(".tv .notification").classList.add("visible")
        setTimeout(() => { document.querySelector(".tv .notification").classList.remove("visible") }, 5000)
        player.nextVideo()
    }
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
    ytU = new URL("http://youtube.com/playlist")
    ytuS = new URLSearchParams()
    ytuS.set("list", playlistId)
    ytU.search = ytuS
    searchp = new URLSearchParams()
    searchp.set("url", ytU)
    dUrl.search = searchp

    d = await (await fetch(dUrl)).text()
    data = document.createElement("html")
    data.innerHTML = d
    console.log(data.querySelector("meta[property='og:image']"),data.querySelector("meta[property='og:title']"), data.querySelector("meta"))
    try {
        image = data.querySelector("meta[property='og:image']").getAttribute("content")
        title = data.querySelector("meta[property='og:title']").getAttribute("content")
        li = document.createElement("li")
        li.setAttribute("id",dbid)
        img = document.createElement("img")
        img.setAttribute("src", image)
        tit = document.createElement("span")
        tit.innerText = title
        li.appendChild(img)
        li.appendChild(tit)
        btn = document.createElement("button")
        btn.setAttribute("class", "material-symbols-outlined")
        btn.innerText = "delete"
        btn.onclick = async ()=>{
            document.querySelector(".loader").classList.add("loading")
            await db.playlists.delete(dbid)
            rebuildPls()
            document.querySelector(".loader").classList.remove("loading")
        }
        li.appendChild(btn)
        li.onclick = (ev) => {
            if(ev.target.tagName == "BUTTON"){
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
