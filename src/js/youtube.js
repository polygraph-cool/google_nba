import * as d3 from 'd3'

let ready = false
let cued = false
const players = {}
const graphic = d3.select('.graphic__video')
const RATIO = 1.5

// gross global cuz youtube
window.onYouTubeIframeAPIReady = () => {
	ready = true
}

function loadScript() {
	// This code loads the IFrame Player API code asynchronously.
	const tag = document.createElement('script')
	tag.src = 'https://www.youtube.com/iframe_api'

	const firstScriptTag = document.getElementsByTagName('script')[0]
	firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
}

function onPlayerReady({ data, target }) {
	console.log('ready')
}

function onPlayerStateChange({ data, target }) {
	// ended
	if (data === 0) {
		target.nbaIndex++
		if (target.nbaIndex >= target.nbaPlaylist.length) target.nbaIndex = 0
		jumpTo({ decade: target.nbaDecade, index: target.nbaIndex })
	}
}

function jumpTo({ decade, index }) {
	const player = players[decade]
	player.nbaIndex = index
	player.loadVideoById(player.nbaPlaylist[index])
}

function setup({ key, playlist }) {
	const year = graphic.append('div')
		.attr('class', 'video__year')

	year.append('p').text(`${key}s`)

	year.append('div').attr('id', `player--${key}`)

	const player = new YT.Player(`player--${key}`, {
		videoId: playlist[0],
		playerVars: {
			controls: 0,
			cc_load_policy: 0,
			enablejsapi: 1,
			fs: 0,
			iv_load_policy: 3,
			modestbranding: 1,
			rel: 0,
			showinfo: 0,
		},
		events: {
			onReady: onPlayerReady,
			onStateChange: onPlayerStateChange,
		}
	})
	player.nbaIndex = 0
	player.nbaPlaylist = playlist
	player.nbaDecade = key
	players[key] = player
}

function resize() {
	const keys = Object.keys(players)
	if (keys.length) {
		const year = graphic.select('.video__year')
		const width = year.node().offsetWidth
		const height = Math.floor(width / RATIO)
		keys.forEach(key => players[key].setSize(width, height))
	}
}

function init() {
	return new Promise((resolve, reject) => {
		loadScript()

		let count = 0
		const maxCount = 100 // 5 seconds
		const check = () => {
			count++
			if (ready) resolve(count)
			else if (count > maxCount) reject('waited too long for youtube api')
			else setTimeout(check, 50)
		}

		// keep checking if youtube api has loaded
		check()
	})
}

export default { init, setup, resize, jumpTo }
