import * as d3 from 'd3'
import 'promis'
import ScrollMagic from 'scrollmagic'
import './utils/find-index-polyfill'
import Youtube from './youtube'
import Text from './text'

let dataByDecade = null
let decades = null

let chartWidth = 0
let chartHeight = 0
const graphic = d3.select('.graphic')
const chart = graphic.select('.graphic__chart')
const sticky = graphic.select('.graphic__sticky')

const scale = { position: d3.scaleBand(), size: null }
const NUM_VIDEOS = 100
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 }
const RATIO = 3

const currentIndex = []

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
		views: formatViews(row.agg_view_count),
		decade_display: row.decade === '2017' ? 'this season' : `${row.decade}s`,
	}
}

function rollupDecade(values) {
	return values
		.slice(0, NUM_VIDEOS)
		.map((d, i) => ({ ...d, index: i }))
}

function loadData() {
	return new Promise((resolve, reject) => {
		d3.csv('assets/curated_merged_by_decade.csv', cleanData, (err, data) => {
			if (err) reject(err)
			else {
				dataByDecade = d3.nest()
					.key(d => d.decade_display).sortKeys(d3.descending)
					.rollup(rollupDecade)
					.entries(data)

				dataByDecade.forEach(d => {
					d.value[0].annotation = 'tk'
				})

				// store data decades to map to array indices
				decades = dataByDecade.map(d => d.key)
				resolve()
			}
		})
	})
}

function displayTitle({ decade, index, reset }) {
	const datum = dataByDecade[decade].value[index]
	const year = graphic.selectAll('.year__chart').filter((d, i) => i === decade)

	const w = year.node().offsetWidth
	const right = index > NUM_VIDEOS / 2
	const pos = scale.position(index) + MARGIN.left
	const x = right ? w - pos : pos

	const annotation = year.select('.year__annotation')
	const annotationText = annotation.select('.annotation__text')
	annotationText.select('.text__title').text(datum.title)
	annotationText.select('.text__date').text(`${datum.date} - ${datum.views} views`)

	annotationText
		.style('left', right ? 'auto' : `${x}px`)
		.style('right', right ? `${x}px` : 'auto')
		.style('text-align', right ? 'right' : 'left')
		.classed('is-visible', true)

	// const current = Youtube.getCurrent()
	annotation.classed('is-visible', true)
}

function updateDetail({ decade, index }) {
	const datum = dataByDecade[decade].value[index]

	const year = chart.selectAll('.year')
		.filter((d, i) => i === decade)

	const w = year.node().offsetWidth
	const right = index > NUM_VIDEOS / 2
	const pos = scale.position(index) + MARGIN.left
	const x = right ? w - pos : pos
	const y = scale.size[decade](datum.agg_view_count) + MARGIN.bottom * 1.25

	const detail = year.select('.year__detail')

	detail.select('.text__title').text(datum.title)
	detail.select('.text__date').text(`${datum.date} - ${datum.views} views`)

	const url = `https://img.youtube.com/vi/${datum.external_video_id}/mqdefault.jpg`

	detail.select('.detail__thumbnail')
		.style('background-image', `url("${url}")`)

	// hide others
	chart.selectAll('.year__detail').classed('is-visible', false)

	// hide click to play
	year.select('.year__annotation')
		.classed('is-visible', false)

	detail
		.style('left', right ? 'auto' : `${x}px`)
		.style('right', right ? `${x}px` : 'auto')
		.style('bottom', `${y}px`)
		.classed('is-visible', true)
}

function jumpToPlay({ decadeIndex, videoIndex }) {
	const d = dataByDecade[decadeIndex].value[videoIndex]

	const year = chart.selectAll('.year')
		.filter((d, i) => i === decadeIndex)

	chart.selectAll('.item')
		.classed('is-playing', false)

	year.selectAll('.item')
		.classed('is-selected', false)
	.filter((d, i) => i === videoIndex)
		.classed('is-playing', true)

	// update label
	Youtube.updateTitle({ decadeIndex, ...d })
	displayTitle({ decade: decadeIndex, index: videoIndex, reset: true })
	currentIndex[decadeIndex] = videoIndex

	updateDetail({ decade: decadeIndex, index: videoIndex })
}

function handlePlayClick(d, i) {
	const decadeIndex = decadeToIndex(d.decade_display)
	Youtube.jumpTo({ decadeIndex, videoIndex: i })

	// update label
	Youtube.updateTitle({ decadeIndex, ...d })

	// deactive other plays
	chart.selectAll('.item')
		.classed('is-playing', false)

	d3.select(this.parentNode).selectAll('.item')
		.classed('is-selected', false)

	d3.select(this)
		.classed('is-playing', true)
		.classed('is-selected', true)

	currentIndex[decadeIndex] = i
	updateDetail({ decade: decadeIndex, index: i })
}

function handlePlayEnter(d) {
	const decade = decadeToIndex(d.decade_display)
	const index = d.index

	d3.select(this.parentNode).selectAll('.item')
		.classed('is-selected', false)

	displayTitle({ decade, index })
}

function handlePlayExit() {
	const parent = d3.select(this.parentNode)

	const decade = decadeToIndex(parent.datum().key)
	const index = currentIndex[decade]

	const year = chart.selectAll('.year')
		.filter((d, i) => i === decade)

	year.selectAll('.item')
		.classed('is-selected', false)
	.filter((d, i) => i === index)
		.classed('is-selected', true)

	displayTitle({ decade, index, reset: true })
}

function createChart() {
	const year = chart.selectAll('.year')
		.data(dataByDecade)
		.enter()
		.append('div')
		.attr('class', 'year')

	const text = year.append('div')
		.attr('class', 'year__text')

	text.append('p')
		.attr('class', 'text__label')
		.text(d => `${d.key}`)

	text.append('p')
		.attr('class', 'text__description')
		.text((d, i) => Text[i].description)

	year.append('p')
		.attr('class', 'year__title')
		.text((d, i) => `Plays ranked by Youtube views, ${Text[i].era}`)

	const yearChart = year.append('div')
		.attr('class', 'year__chart')

	const svg = yearChart.append('svg')
		.attr('class', 'chart__svg')

	const g = svg.append('g')
		.attr('class', 'g-graphic')

	g.append('g')
		.attr('class', 'g-axis')

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

	detail.append('div')
		.attr('class', 'detail__thumbnail')

	const detailText = detail.append('p')
		.attr('class', 'detail__text')

	detailText.append('span').attr('class', 'text__title')
	detailText.append('span').attr('class', 'text__date')

	const annotation = yearChart.append('div')
		.attr('class', 'year__annotation')

	const annotationText = annotation.append('p')
		.attr('class', 'annotation__text')

	annotationText.append('span').attr('class', 'text__click')
		.text('Click to play')
	annotationText.append('span').attr('class', 'text__title')
	annotationText.append('span').attr('class', 'text__date')
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
	dataByDecade.forEach((decade, decadeIndex) => {
		const year = chart.selectAll('.year')
			.filter((d, i) => i === decadeIndex)

		let targetIndex = 0
		if (decadeIndex > 0) targetIndex = Math.floor(Math.random() * NUM_VIDEOS / 2)
		year.selectAll('.item')
			.filter((d, i) => i === targetIndex)
				.classed('is-selected', true)

		displayTitle({ decade: decadeIndex, index: targetIndex, reset: true })
		currentIndex.push(targetIndex)
	})
}

function updateScales() {
	scale.position.range([0, chartWidth])
	scale.size.forEach(s => s.range([0, chartHeight]))
}

function updateAxis() {
	const svg = chart.selectAll('.chart__svg')
	const percentiles = [0.33, 0.66, 1]
	svg.each(function(datum, decade) {
		const values = percentiles.map((p) => {
			const h = chartHeight * p
			const views = formatViews(scale.size[decade].invert(h))
			return { pos: chartHeight - h, views }
		})
		const axis = d3.select(this).select('.g-axis')

		axis.attr('transform', `translate(${chartWidth}, 0)`)

		const label = axis.selectAll('.label')
			.data(values)

		const enter = label.enter().append('g')
			.attr('class', 'axis__label')

		const line = enter.append('line')

		line
			.attr('x1', 0)
			.attr('y1', 0)
			.attr('x2', -chartWidth)
			.attr('y2', 0)

		const text = enter.append('text')

		text
			.attr('text-anchor', 'end')
			.attr('alignment-baseline', 'baseline')
			.attr('dy', -2)
			.text((d, i) => `${d.views} ${i === 2 ? 'views' : ''}`)

		enter.merge(label)
			.attr('transform', d => `translate(0, ${d.pos})`)
	})
}

function updateChartElements() {
	const outerWidth = chartWidth + MARGIN.left + MARGIN.right
	const outerHeight = chartHeight + MARGIN.top + MARGIN.bottom
	const svg = chart.selectAll('.chart__svg')
	const yearChart = chart.selectAll('.year__chart')

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
function resize() {
	Youtube.resize()
	const yearChart = chart.selectAll('.year__chart')
	const w = yearChart.node().offsetWidth
	const h = Math.floor(w / RATIO)

	chartWidth = w - MARGIN.left - MARGIN.right
	chartHeight = h - MARGIN.top - MARGIN.bottom

	updateScales()
	updateAxis()
	updateChartElements()
}

function setupScroll() {
	const controller = new ScrollMagic.Controller()

	const el = d3.select('.graphic')

	const enterExitScene = new ScrollMagic.Scene({
		triggerElement: el.node(),
		triggerHook: '0',
		duration: el.node().offsetHeight - sticky.node().offsetHeight,
	})

	enterExitScene
		.on('enter', function(event) {
			const bb = sticky.node().getBoundingClientRect()
			const right = d3.select('main').node().offsetWidth - bb.right

			sticky
				.classed('is-fixed', true)
				.style('right', `${right}px`)
				.style('width', `${bb.width}px`)

			const bottom = event.scrollDirection === 'REVERSE'
			if (bottom) sticky.classed('is-bottom', false)
		})
		.on('leave', function(event) {

			sticky
				.classed('is-fixed', false)
				.style('right', '0')
				.style('width', '45%')
			const bottom = event.scrollDirection === 'FORWARD'
			if (bottom) sticky.classed('is-bottom', true)
		})
	enterExitScene.addTo(controller)
}

function setup() {
	setupScales()
	Youtube.setup(dataByDecade)
	createChart()
	resize()
	// createKey()
	setupSearch()
	setupTitles()
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
