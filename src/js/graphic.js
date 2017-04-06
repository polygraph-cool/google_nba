import * as d3 from 'd3'
import 'promis'
import ScrollMagic from 'scrollmagic'
import './utils/find-index-polyfill'
import Youtube from './youtube'

let rawData = null
let dataByDecade = null
let decades = null

let chartWidth = 0
let chartHeight = 0
const graphic = d3.select('.graphic')
const chart = graphic.select('.graphic__chart')
const video = graphic.select('.graphic__video')

const scale = { position: d3.scaleBand(), size: null }
const NUM_VIDEOS = 100
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 }
const RATIO = 3


const categoryColors = {
	dunk: '#e41a1c',
	pass: '#377eb8',
	block: '#4daf4a',
	move: '#984ea3',
	shot: '#ff7f00',
	fight: '#ffff33',
	injury: '#a65628',
	untagged: '#ccc',
}

function formatViews(num) {
	return d3.format('.2s')(num)
}

function formatDate(str) {
	const t = d3.timeParse('%Y%m%d')(str)
	return d3.timeFormat('%b %d, %Y')(t)
}

function decadeToIndex(decade) {
	return decades.findIndex(d => d === decade)
}

function cleanData(row) {
	// add in 2017 as its own decade
	return {
		...row,
		agg_view_count: +row.agg_view_count,
		title: row.title_custom,
		date: formatDate(row.date),
		decade_display: row.decade === '2017' ? 'this season' : `${row.decade}s`,
	}
}

function rollupDecade(values) {
	// const sorted = values.sort((a, b) =>
	// 	d3.descending(a.agg_view_count, b.agg_view_count)
	// )
	return values
		.slice(0, NUM_VIDEOS)
		.map((d, i) => ({ ...d, index: i }))
}

function loadData() {
	return new Promise((resolve, reject) => {
		d3.csv('assets/curated_merged_by_decade.csv', cleanData, (err, data) => {
			if (err) reject(err)
			else {
				rawData = data
				dataByDecade = d3.nest()
					.key(d => d.decade_display).sortKeys(d3.descending)
					.rollup(rollupDecade)
					.entries(data)
					// .sort((a, b) => d3.descending(a.key, b.key))

				dataByDecade.forEach(d => {
					d.value[0].annotation = 'tk'
				})

				// console.log(dataByDecade)
				// store data decades to map to array indices
				decades = dataByDecade.map(d => d.key)
				resolve()
			}
		})
	})
}

function displayTitle({ decade, index, reset }) {
	const d = dataByDecade[decade].value[index]
	const year = graphic.selectAll('.year__chart').filter((d, i) => i === decade)

	const w = year.node().offsetWidth
	const right = index > NUM_VIDEOS / 2
	const pos = scale.position(index) + MARGIN.left
	const x = right ? w - pos : pos
	const y = chartHeight - scale.size[decade](d.agg_view_count)
	const views = formatViews(d.agg_view_count)

	const detail = year.select('.year__detail')

	detail.select('.detail__text')
		.text(`${d.date}: ${d.title} (${views} views)`)

	detail
		.style('left', right ? 'auto' : `${x}px`)
		.style('right', right ? `${x}px` : 'auto')
		.style('top', `${y}px`)
		.classed('is-visible', true)

	// const url = `https://img.youtube.com/vi/${d.external_video_id}/mqdefault.jpg`

	// year.select('.annotation__thumbnail')
	// 	.style('background-image', `url("${url}")`)
	// 	.style('left', right ? 'auto' : `${x}px`)
	// 	.style('right', right ? `${x}px` : 'auto')
	// 	.classed('is-visible', !reset)
}

function jumpToPlay({ decadeIndex, videoIndex }) {
	const year = chart.selectAll('.year')
		.filter((d, i) => i === decadeIndex)

	year.selectAll('.item')
		.classed('is-active', false)
		.filter((d, i) => i === videoIndex)
			.classed('is-active', true)

	// update label
	const d = dataByDecade[decadeIndex].value[videoIndex]
	Youtube.updateTitle({ decadeIndex, title: d.title })
	displayTitle({ decade: decadeIndex, index: videoIndex, reset: true })
}

function handlePlayClick(d, i) {
	const decadeIndex = decadeToIndex(d.decade_display)
	Youtube.jumpTo({ decadeIndex, videoIndex: i })

	// update label
	Youtube.updateTitle({ decadeIndex, title: d.title })

	// deactive other plays
	d3.select(this.parentNode).selectAll('.item')
		.classed('is-active', false)

	d3.select(this).classed('is-active', true)
}

function handlePlayEnter(d) {
	const decade = decadeToIndex(d.decade_display)
	const index = d.index
	displayTitle({ decade, index })
}

function handlePlayExit() {
	const parent = d3.select(this.parentNode)
	parent.select('.detail__text')
		.classed('is-visible', false)
		.text('')
	parent.select('.annotation__thumbnail')
		.classed('is-visible', false)

	const decadeIndex = decadeToIndex(parent.datum().key)
	const { player, video } = Youtube.getCurrent(decadeIndex)
	displayTitle({ decade: player, index: video, reset: true })
}

function createAnnotation(d) {
	// console.log(d)
	const grandpa = d3.select(this.parentNode.parentNode)
	const right = d.index > NUM_VIDEOS / 2
	const percent = Math.floor(d.index / NUM_VIDEOS * 100)
	const off = right ? 100 - percent : percent
	const before = right ? '' : '&dtrif; '
	const after = right ? ' &dtrif;' : ''
	grandpa.select('.plays__annotation').append('p')
		.attr('class', 'annotation__text')
		.html(`${before}${d.annotation}${after}`)
		.style('margin-left', right ? 'auto' : `${off}%`)
		.style('margin-right', right ? `${off}%` : 'auto')
		.style('text-align', right ? 'right' : 'left')

	grandpa.select('.plays__annotation').append('div')
		.attr('class', 'annotation__thumbnail')
}

function createChart() {
	const year = chart.selectAll('.year')
		.data(dataByDecade)
		.enter().append('div')
			.attr('class', 'year')

	const text = year.append('div')
		.attr('class', 'year__text')

	text.append('p')
		.attr('class', 'text__label')
		.text(d => `${d.key}`)

	text.append('p')
		.attr('class', 'text__description')
		.text(d => `What is the most watch NBA video of all-time? We identified over 200,000 NBA videos.`)

	const yearChart = year.append('div')
		.attr('class', 'year__chart')

	const svg = yearChart.append('svg')
		.attr('class', 'chart__svg')

	const g = svg.append('g')
		.attr('class', 'g-graphic')

	const items = g.append('g')
		.attr('class', 'g-items')
		.on('mouseleave', handlePlayExit)

	const item = items.selectAll('.item')
		.data(d => d.value)
		.enter().append('g')

	item.attr('class', 'item')
		.on('click', handlePlayClick)
		.on('mouseenter', handlePlayEnter)

	item.append('rect')

	const detail = yearChart.append('div')
		.attr('class', 'year__detail')

	detail.append('p')
		.attr('class', 'detail__text')
		.text((d) => {
			const first = d.value[0]
			const views = formatViews(first.agg_view_count)
			return `${first.title} ${views} views`
		})
}

function createKey() {
	const key = chart.append('div')
		.attr('class', 'chart__key')

	const data = Object.keys(categoryColors)

	key.selectAll('p')
		.data(data)
		.enter().append('p')
		.text(d => d)
		.style('background-color', d => categoryColors[d])
}

function handleSearchChange() {
	let name = this.value ? this.value.toLowerCase() : ''
	name = name.length > 2 ? name : null

	chart.selectAll('.item')
		.classed('is-player', false)
		.filter(d => d.players.toLowerCase().includes(name))
		.classed('is-player', true)
}

function setupScales() {
	scale.position
		.domain(d3.range(0, NUM_VIDEOS))
		.padding(0)

	scale.size = decades.map((d, i) => {
		const max = d3.max(dataByDecade[i].value, x => x.agg_view_count)
		return d3.scalePow()
			.domain([0, max])
			.exponent(0.5)
	})
}

function setupSearch() {
	d3.select('.search__input input')
		.on('keyup', handleSearchChange)
}

function setupTitles() {
	dataByDecade.forEach((d, i) => {
		displayTitle({ decade: i, index: 0, reset: true })
	})
}

function updateScales() {
	scale.position.range([0, chartWidth])
	scale.size.forEach(s => s.range([0, chartHeight]))
}

function resize() {
	Youtube.resize()
	const svg = chart.selectAll('.chart__svg')
	const yearChart = chart.selectAll('.year__chart')
	const w = yearChart.node().offsetWidth
	const h = Math.floor(w / RATIO)

	chartWidth = w - MARGIN.left - MARGIN.right
	chartHeight = h - MARGIN.top - MARGIN.bottom

	const outerWidth = chartWidth + MARGIN.left + MARGIN.right
	const outerHeight = chartHeight + MARGIN.top + MARGIN.bottom
	updateScales()

	yearChart
		.style('width', `${outerWidth}px`)
		.style('height', `${outerHeight}px`)

	svg
		.style('width', outerWidth)
		.style('height', outerHeight)

	svg.select('g')
		.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

	const x = scale.position.bandwidth()

	svg.selectAll('.item rect')
		.attr('width', x)
		.attr('height', (d) => {
			const index = decadeToIndex(d.decade_display)
			const v = scale.size[index](d.agg_view_count)
			return v
		})
		.attr('x', d => scale.position(d.index))
		.attr('y', (d) => {
			const index = decadeToIndex(d.decade_display)
			const v = chartHeight - scale.size[index](d.agg_view_count)
			return v
		})
}

function setupScroll() {
	const controller = new ScrollMagic.Controller()

	const el = d3.select('.graphic')

	const enterExitScene = new ScrollMagic.Scene({
		triggerElement: el.node(),
		triggerHook: '0',
		duration: el.node().offsetHeight - video.node().offsetHeight,
	})

	enterExitScene
		.on('enter', function(event) {
			console.log('enter')
			video.classed('is-fixed', true)
			const bottom = event.scrollDirection === 'REVERSE'
			if (bottom) video.classed('is-bottom', false)
		})
		.on('leave', function(event) {
			console.log('exit')
			video.classed('is-fixed', false)
			const bottom = event.scrollDirection === 'FORWARD'
			if (bottom) video.classed('is-bottom', true)
		})
	enterExitScene.addTo(controller)
}

function setup() {
	setupScales()
	Youtube.setup(dataByDecade)
	createChart()
	// createKey()
	setupTitles()
	setupSearch()
	resize()
	setupScroll()
	return Promise.resolve()
}

function init() {
	loadData()
		.then(Youtube.init)
		.then(setup)
		.catch(err => console.log(err))
}

export default { init, resize, jumpToPlay }
