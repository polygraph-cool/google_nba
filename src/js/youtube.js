import * as d3 from 'd3'
import Graphic from './graphic'

let ready = false
const players = []
const graphic = d3.select('.graphic__video')
const RATIO = 1.5
let currentPlayerIndex = 0

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

function onPlayerReady({ target }) {
	// target.playVideo()
}

function pauseVideos() {
	players.forEach((player, i) => {
		if (i !== currentPlayerIndex) player.pauseVideo()
	})
}

function onPlayerStateChange({ data, target }) {
	// end of video, move on to next
	if (data === 0) {
		target.videoIndex++
		if (target.videoIndex >= target.nbaPlaylist.length) target.videoIndex = 0
		const params = {
			playerIndex: target.playerIndex,
			videoIndex: target.videoIndex,
		}
		jumpTo(params)
		Graphic.jumpToPlay(params)
	} else if (data === 1) {
		currentPlayerIndex = target.playerIndex
		pauseVideos()
		resize()
	}
}

function jumpTo({ playerIndex, videoIndex }) {
	currentPlayerIndex = playerIndex
	pauseVideos()

	const player = players[playerIndex]
	player.videoIndex = videoIndex
	player.loadVideoById(player.nbaPlaylist[videoIndex])

	resize()
}

function setupPlayer(d, i) {
	const playlist = d.value.map(v => v.external_video_id)

	const player = new YT.Player(`player--${i}`, {
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
		},
	})

	player.videoIndex = 0
	player.nbaPlaylist = playlist
	player.playerIndex = i
	players.push(player)
}

function resize() {
	// resize
	graphic.selectAll('.video__year').classed('is-active', false)
	graphic.select(`.video__year--${currentPlayerIndex}`).classed('is-active', true)

	if (players.length) {
		players.forEach((player, i) => {
			const year = graphic.select(`.video__year--${i}`)
			const width = year.node().offsetWidth
			const height = Math.floor(width / RATIO)
			player.setSize(width, height)
		})
	}
}

function setup(data) {
	const year = graphic.selectAll('.year')
		.data(data)
	.enter().append('div')
		.attr('class', (d, i) => `video__year video__year--${i}`)
		.classed('is-active', d => d.key === '2010')

	year.append('p')
		.attr('class', 'year__label')
		.text(d => `${d.key}`)

	year.append('div').attr('id', (d, i) => `player--${i}`)

	year.each(setupPlayer)

	resize()
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
