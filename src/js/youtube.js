import * as d3 from 'd3'
import Graphic from './graphic'

let ready = false
let initialAutoplay = false
let player = null
const graphic = d3.select('.graphic__video')
const RATIO = 1.5
let dataByDecade = null

function getCurrent(i) {
	return { player: i, video: player.videoIndex }
}

function resize() {
	if (player) {
		const width = graphic.select('.year__video').node().offsetWidth
		const height = Math.floor(width / RATIO)
		player.setSize(width, height)
		// const offset = (window.innerHeight - height) / 4
		// graphic.style('padding-top', `${offset}px`)
	}
}

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
	if (!initialAutoplay) {
		initialAutoplay = true
		target.playVideo()
	}
	Graphic.jumpToPlay(target)
}

function updateTitle({ decadeIndex, title }) {
	graphic.select('.label__year').text(dataByDecade[decadeIndex].key)
	graphic.select('.label__title').text(title)
}

function jumpTo({ decadeIndex, videoIndex }) {
	player.videoIndex = videoIndex
	player.decadeIndex = videoIndex
	const id = dataByDecade[decadeIndex].value[videoIndex].external_video_id
	player.loadVideoById(id)
	resize()
}

function onPlayerStateChange({ data, target }) {
	// end of video, move on to next
	if (data === 0) {
		target.videoIndex++
		if (target.videoIndex >= dataByDecade[target.decadeIndex].value.length) target.videoIndex = 0
		const params = {
			decadeIndex: target.decadeIndex,
			videoIndex: target.videoIndex,
		}
		jumpTo(params)
		Graphic.jumpToPlay(params)
	} else if (data === 1) {
		resize()
	}
}

function setupPlayer() {
	const first = dataByDecade[0].value[0]
	player = new YT.Player('player', {
		videoId: first.external_video_id,
		playerVars: {
			controls: 1,
			cc_load_policy: 0,
			enablejsapi: 1,
			fs: 0,
			iv_load_policy: 3,
			modestbranding: 0,
			rel: 0,
			showinfo: 0,
		},
		events: {
			onReady: onPlayerReady,
			onStateChange: onPlayerStateChange,
		},
	})

	player.videoIndex = 0
	player.decadeIndex = 0
	// player.nbaPlaylist = playlist
	// player.decadeIndex = i
	// players.push(player)
}

function setup(data) {
	dataByDecade = data

	graphic.append('div')
		.attr('class', 'year__video')
	.append('div')
		.attr('id', 'player')

	const label = graphic.append('p')
		.attr('class', 'year__label')
	label.append('span')
		.attr('class', 'label__year')
	label.append('span')
		.attr('class', 'label__title')

	setupPlayer()
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

export default { init, setup, resize, jumpTo, updateTitle, getCurrent }
