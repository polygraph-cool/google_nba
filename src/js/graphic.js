import * as d3 from 'd3'
import 'promis'
import './utils/find-index-polyfill'
import Youtube from './youtube'

let data = null
let dataByDecade = null
let decades = null
const graphic = d3.select('.graphic__chart')

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

function decadeToIndex(decade) {
	return decades.findIndex(d => d === decade)
}

function cleanData(row) {
	return {
		...row,
		estimated_view_count: +row.estimated_view_count,
		duration: +row.duration,
		categories: row.categories ? row.categories.split('|') : null,
	}
}

function rollupDecade(values) {
	const sorted = values.sort((a, b) =>
		d3.descending(a.estimated_view_count, b.estimated_view_count)
		// d3.ascending(a.duration, b.duration)
	)
	return sorted.slice(0, 50)
}

function loadData() {
	return new Promise((resolve, reject) => {
		d3.csv('assets/plays.csv', cleanData, (err, result) => {
			if (err) reject(err)
			else {
				data = result
				dataByDecade = d3.nest()
					.key(d => d.decade)
					.rollup(rollupDecade)
					.entries(data)
					.sort((a, b) => d3.descending(a.key, b.key))

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

	year.selectAll('.play')
		.classed('is-active', false)
		.filter((d, i) => i === videoIndex)
			.classed('is-active', true)
}

function handlePlayClick(d, i) {
	const playerIndex = decadeToIndex(d.decade)
	Youtube.jumpTo({ playerIndex, videoIndex: i })

	// deactive other plays
	d3.select(this.parentNode).selectAll('.play')
		.classed('is-active', false)

	d3.select(this).classed('is-active', true)
}

function createChart() {
	const year = graphic.selectAll('.year')
		.data(dataByDecade)
		.enter().append('div')
			.attr('class', 'year')

	year.append('p')
		.attr('class', 'year__label')
		.text(d => `${d.key}s`)

	const plays = year.append('div')
		.attr('class', 'year__plays')

	const play = plays.selectAll('.plays')
		.data(d => d.value)
		.enter().append('div')

	play.attr('class', 'play')
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
