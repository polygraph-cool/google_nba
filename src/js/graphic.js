import * as d3 from 'd3'
import 'promis'
import './utils/find-index-polyfill'
import Youtube from './youtube'

let dataByDecade = null
let decades = null
const graphic = d3.select('.graphic__chart')
const NUM_VIDEOS = 50

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

function decadeToIndex(decade) {
	return decades.findIndex(d => d === decade)
}

function cleanData(row) {
	// add in 2017 as its own decade
	return {
		...row,
		estimated_view_count: +row.estimated_view_count,
		duration: +row.duration,
		categories: row.categories ? row.categories.split('|') : null,
		decade_display: row.date.substring(0, 4) === '2017' ? 'this season' : `${row.decade}s`,
	}
}

function rollupDecade(values) {
	const sorted = values.sort((a, b) =>
		d3.descending(a.estimated_view_count, b.estimated_view_count)
	)
	// TODO remove 1, + 1 slice, this is temp
	return sorted
		.slice(1, NUM_VIDEOS + 1)
		.map((d, i) => ({ ...d, index: i }))
}

function loadData() {
	return new Promise((resolve, reject) => {
		d3.csv('assets/plays.csv', cleanData, (err, data) => {
			if (err) reject(err)
			else {
				dataByDecade = d3.nest()
					.key(d => d.decade_display)
					.rollup(rollupDecade)
					.entries(data)
					.sort((a, b) => d3.descending(a.key, b.key))

				// TODO remove
				dataByDecade.forEach(d => {
					const ran = Math.floor(Math.random() * NUM_VIDEOS)
					d.value[ran].annotation = 'random annotation for testing'
				})
				// store data decades to map to array indices
				decades = dataByDecade.map(d => d.key)
				resolve()
			}
		})
	})
}

function jumpToPlay({ playerIndex, videoIndex }) {
	const year = graphic.selectAll('.year')
		.filter((d, i) => i === playerIndex)

	year.selectAll('.item')
		.classed('is-active', false)
		.filter((d, i) => i === videoIndex)
			.classed('is-active', true)
}

function handlePlayClick(d, i) {
	const playerIndex = decadeToIndex(d.decade_display)
	Youtube.jumpTo({ playerIndex, videoIndex: i })

	// deactive other plays
	d3.select(this.parentNode).selectAll('.item')
		.classed('is-active', false)

	d3.select(this).classed('is-active', true)
}

function handlePlayEnter(d, i) {
	const parent = this.parentNode
	const parentW = parent.offsetWidth
	const w = this.getBoundingClientRect().width
	const right = i > NUM_VIDEOS / 2
	let x = Math.floor(w * i)
	if (right) x = parentW - x - w

	const views = formatViews(d.estimated_view_count)
	const grandpa = d3.select(parent.parentNode)
	grandpa.select('.detail__text')
		.text(`tk title here ${views} views`)
		.style('left', right ? 'auto' : `${x}px`)
		.style('right', right ? `${x}px` : 'auto')
}

function handlePlayExit(d) {
	d3.select(this.parentNode).select('.detail__text').text('')
}

function createChart() {
	const year = graphic.selectAll('.year')
		.data(dataByDecade)
		.enter().append('div')
			.attr('class', 'year')

	year.append('p')
		.attr('class', 'year__label')
		.text(d => `${d.key}`)

	const plays = year.append('div')
		.attr('class', 'year__plays')

	plays.append('div')
		.attr('class', 'plays__annotation')

	const items = plays.append('div')
		.attr('class', 'plays__items')
		.on('mouseleave', handlePlayExit)

	const item = items.selectAll('.item')
		.data(d => d.value)
		.enter().append('div')

	item.attr('class', 'item')
		.style('background-color', (d) => {
			const cat = d.categories ? d.categories[0] : 'untagged'
			return categoryColors[cat]
		})
		.style('color', (d) => {
			const cat = d.categories ? d.categories[0] : 'untagged'
			return categoryColors[cat]
		})
		.classed('is-active', (d, i) => i === 0)
		.on('click', handlePlayClick)
		.on('mouseenter', handlePlayEnter)

	item.filter(d => d.annotation)
		.each(function(d) {
			const grandpa = d3.select(this.parentNode.parentNode)
			const right = d.index > NUM_VIDEOS / 2
			const percent = Math.floor(d.index / NUM_VIDEOS * 100) + 1
			const off = right ? 100 - percent : percent
			const before = right ? '&dtrif; ' : ''
			const after = right ? '' : ' &dtrif;'
			grandpa.select('.plays__annotation')
				.append('p')
					.html(`${before}${d.annotation}${after}`)
					.style('margin-left', right ? 'auto' : `${off}%`)
					.style('margin-right', right ? `${off}%` : 'auto')
					.style('text-align', right ? 'right' : 'left')
		})
		// .append('p')
		// .attr('class', 'item__annotation')
		// .text(d => d.annotation)
		// .style('text-align', d => {
		// 	// return 'center'
		// 	return d.index < NUM_VIDEOS / 2 ? 'left' : 'right'
		// })


	const detail = plays.append('div')
		.attr('class', 'plays__detail')

	detail.append('p')
		.attr('class', 'detail__text')
		.text(d => {
			const views = formatViews(d.value[0].estimated_view_count)
			return `tk title here ${views} views`
		})
}

function createKey() {
	const key = graphic.append('div')
		.attr('class', 'chart__key')

	const data = Object.keys(categoryColors)

	key.selectAll('p')
		.data(data)
		.enter().append('p')
		.text(d => d)
		.style('background-color', d => categoryColors[d])
}

function setup() {
	Youtube.setup(dataByDecade)
	createChart()
	createKey()
	return Promise.resolve()
}

function resize() {
	Youtube.resize()
}

function init() {
	loadData()
		.then(Youtube.init)
		.then(setup)
		.catch(err => console.log(err))
}

export default { init, resize, jumpToPlay }
