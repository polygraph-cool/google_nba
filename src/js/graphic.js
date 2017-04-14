import * as d3 from 'd3'
import 'promis'
import ScrollMagic from 'scrollmagic'
import uniq from 'lodash.uniqby'
import * as noUiSlider from 'nouislider'
import './utils/find-index-polyfill'
import Youtube from './youtube'
import Text from './text'
import * as Dom from './utils/dom'

let mobile = false

let dataByDecade = null
let dataFlat = null
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

const decadeTitles = {
	'2017': 'this season',
	'2010': '2010-2015',
	'2000': '2000s',
	'1990': '1990s',
	'1980': '1980s',
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
		decade_display: decadeTitles[row.decade],
		team: row.team ? row.team.split('|') : [],
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

				dataFlat = d3.merge(dataByDecade.map(d => d.value))
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
	const pos = scale.position(index) + MARGIN.left - scale.position.bandwidth() / 4
	const x = right ? w - pos - 4 : pos

	const annotation = year.select('.year__annotation')
	const annotationText = annotation.select('.annotation__text')
	annotationText.select('.text__title').text(datum.title)
	annotationText.select('.text__date').text(`${datum.date} - ${datum.views} views`)

	annotationText
		.style('left', right ? 'auto' : `${x}px`)
		.style('right', right ? `${x}px` : 'auto')
		.style('text-align', right ? 'right' : 'left')
		.classed('is-right', right)
		.classed('is-visible', true)
		.attr('data-decade', decade)
		.attr('data-index', index)

	// const current = Youtube.getCurrent()
	annotation.classed('is-visible', true)

	// hide axis label
	const dist = mobile ? 12 : 8
	const hideBefore = index < dist
	const hideAfter = index > NUM_VIDEOS - dist
	year.classed('is-hidden-before', hideBefore)
	year.classed('is-hidden-after', hideAfter)
}

function updateDetail({ decade, index }) {
	const datum = dataByDecade[decade].value[index]

	const year = chart.selectAll('.year')
		.filter((d, i) => i === decade)

	const w = year.node().offsetWidth
	const right = index > NUM_VIDEOS / 2
	const pos = scale.position(index) + MARGIN.left - scale.position.bandwidth() / 4
	const x = right ? w - pos - 8 : pos
	const y = scale.size[decade](datum.agg_view_count) + MARGIN.bottom * 1.6

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
		.classed('is-right', right)
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
	Youtube.updateTitle({ ...d })
	displayTitle({ decade: decadeIndex, index: videoIndex, reset: true })
	currentIndex[decadeIndex] = videoIndex

	updateDetail({ decade: decadeIndex, index: videoIndex })
}

function handleAnnotationClick() {
	if (mobile) {
		const sel = d3.select(this)
		const index = +sel.attr('data-index')
		const decade = +sel.attr('data-decade')
		const item = chart.selectAll('.year')
			.filter((d, i) => i === decade)
			.selectAll('.item')
			.filter(d => d.index === index)

		handlePlayClick.call(item.node(), item.datum())
	}
}

function handlePlayClick(d) {
	const decadeIndex = decadeToIndex(d.decade_display)
	Youtube.jumpTo({ decadeIndex, videoIndex: d.index })

	// update label
	Youtube.updateTitle({ ...d })

	// deactive other plays
	chart.selectAll('.item')
		.classed('is-playing', false)

	d3.select(this.parentNode).selectAll('.item')
		.classed('is-selected', false)

	d3.select(this)
		.classed('is-playing', true)
		.classed('is-selected', true)

	currentIndex[decadeIndex] = d.index
	updateDetail({ decade: decadeIndex, index: d.index })
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

function handleResultClick(datum) {
	const index = decadeToIndex(decadeTitles[datum.key])
	const year = chart.selectAll('.year').filter((d, i) => i === index)
	const el = year.node()
	Dom.jumpTo(el)

	// const item = year.selectAll('.item').filter(d => d.index === datum.value.index).node()
	// handlePlayClick.call(item, datum.value)
}

function handleSlider({ decade, index }) {
	const j = decadeToIndex(decade)
	const year = d3.selectAll('.year').filter((d, i) => i === j)

	const item = year.selectAll('.item')
		.filter((d, i) => i === index)

	handlePlayEnter.call(item.node(), item.datum())
}

function resetTeam() {
	d3.select('.team__options option').property('selected', true)
	chart.selectAll('.item').classed('is-team', false)
}

function resetSearch() {
	d3.select('.search__input input').node().value = ''
	chart.selectAll('.item').classed('is-player', false)
	graphic.selectAll('.result').remove()
}

function resetCategory() {
	d3.selectAll('.category__options li').classed('is-selected', false)
	chart.selectAll('.item').classed('is-category', false)
}

function handleSearchChange() {
	let name = this.value ? this.value.toLowerCase().replace(/]W/g, '') : ''
	name = name.length > 2 ? name : null

	if (name) {
		resetTeam()
		resetCategory()
	}

	chart.selectAll('.item')
		.classed('is-player', false)
		.filter(d => d.players.toLowerCase().includes(name))
		.classed('is-player', true)

	const filtered = dataFlat.filter(d => d.players.toLowerCase().replace(/]W/g, '').includes(name))

	const byDecade = d3.nest()
		.key(d => d.decade)
		.rollup(v => v.length)
		.entries(filtered)

	const results = graphic.select('.results')
	results.selectAll('.result').remove()

	const p = results.selectAll('.result').data(byDecade)
		.enter().append('p')
			.attr('class', 'result')

	p.append('span')
		.attr('class', 'result__era')
		.text(d => `${decadeTitles[d.key]}: `)

	p.append('span')
		.attr('class', 'result__count')
		.text((d) => {
			const v = d.value === 1 ? '' : 's'
			return `${d.value} moment${v}`
		})
		.on('click', handleResultClick)
}

function handleTeamChange() {
	resetSearch()
	resetCategory()

	const team = this.value.toLowerCase()
	chart.selectAll('.item')
		.classed('is-team', false)
		.filter(d => d.team.includes(team))
			.classed('is-team', true)
}

function handleEraChange() {
	const index = +this.value
	const years = d3.selectAll('.year')
	years.classed('is-active', (d, i) => i === index)
}

function handleCategoryChange() {
	resetTeam()
	resetSearch()

	const sel = d3.select(this)
	const cat = sel.attr('data-type')

	d3.selectAll('.category__options li').classed('is-selected', false)
	sel.classed('is-selected', true)

	chart.selectAll('.item')
		.classed('is-category', false)
		.filter(d => d.type === cat)
			.classed('is-category', true)
}

function createChart() {
	const year = chart.selectAll('.year')
		.data(dataByDecade)
		.enter()
		.append('div')
		.attr('class', 'year')
		.classed('is-active', (d, i) => i === 0)

	const text = year.append('div')
		.attr('class', 'year__text')

	text.append('p')
		.attr('class', 'text__label')
		.text(d => `${d.key}`)

	text.append('p')
		.attr('class', 'text__description')
		.attr('data-index', (d, i) => i)
		.html((d, i) => Text[i])

	const yearChart = year.append('div')
		.attr('class', 'year__chart')

	const svg = yearChart.append('svg')
		.attr('class', 'chart__svg')

	yearChart.append('p')
		.attr('class', 'year__title')
		.html(function(d,i){
			return "`Moments ranked by<br>YouTube views, "+d.key;
		})
		// .html((d, i) => `Moments ranked by<br>YouTube views, ${decadeTitles[i]}`)

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
		.attr('class', 'item__bar')

	item.append('rect')
		.attr('class', 'item__interact')

	const detail = yearChart.append('div')
		.attr('class', 'year__detail')

	detail.append('div')
		.attr('class', 'detail__thumbnail')

	const annotation = yearChart.append('div')
		.attr('class', 'year__annotation')

	const annotationText = annotation.append('p')
		.attr('class', 'annotation__text')
		.on('click', handleAnnotationClick)

	annotationText.append('span').attr('class', 'text__arrow')

	annotationText.append('span').attr('class', 'text__click')
		.text(`${mobile ? 'Tap': 'Click'} to play`)
	annotationText.append('span').attr('class', 'text__title')
	annotationText.append('span').attr('class', 'text__date')

	year.append('div')
		.attr('class', 'year__slider')
		.attr('id', (d, i) => `slider-${i}`)
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

		axis.selectAll('.axis__label').remove()

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
	// 	.style('width', `${outerWidth}px`)
		.style('height', `${outerHeight}px`)

	svg
		.style('width', outerWidth)
		.style('height', outerHeight)

	svg.select('g')
		.attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

	const x = scale.position.bandwidth()

	svg.selectAll('.item__bar')
		.attr('width', x)
		.attr('height', (d) => {
			if (mobile) return chartHeight
			const index = decadeToIndex(d.decade_display)
			const v = scale.size[index](d.agg_view_count)
			return v
		})
		.attr('x', d => scale.position(d.index))
		.attr('y', (d) => {
			if (mobile) return 0
			const index = decadeToIndex(d.decade_display)
			const v = chartHeight - scale.size[index](d.agg_view_count)
			return v
		})

	svg.selectAll('.item__interact')
		.attr('width', x)
		.attr('height', chartHeight)
		.attr('x', d => scale.position(d.index))
		.attr('y', 0)
}

function resize() {
	mobile = d3.select('body').node().offsetWidth < 800
	Youtube.resize()
	const yearChart = chart.selectAll('.year__chart')
	const w = yearChart.node().offsetWidth
	const h = mobile ? 80 : Math.floor(w / RATIO)

	chartWidth = w - MARGIN.left - MARGIN.right
	chartHeight = h - MARGIN.top - MARGIN.bottom

	updateScales()
	updateChartElements()
	updateAxis()
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
			if (!mobile) {
				const bb = sticky.node().getBoundingClientRect()
				const right = d3.select('main').node().offsetWidth - bb.right

				sticky
					.classed('is-fixed', true)
					.style('right', `${right}px`)
					.style('width', `${bb.width}px`)

				const bottom = event.scrollDirection === 'REVERSE'
				if (bottom) sticky.classed('is-bottom', false)
			}
		})
		.on('leave', function(event) {
			if (!mobile) {
				sticky
					.classed('is-fixed', false)
					.style('right', '0')
					.style('width', '45%')
				const bottom = event.scrollDirection === 'FORWARD'
				if (bottom) sticky.classed('is-bottom', true)
			}
		})
	enterExitScene.addTo(controller)
}

function setupKey() {
	// flatten teams
	const teams = uniq(d3.merge(dataFlat.map(d => d.team)))
		.map(d => d.toUpperCase())

	teams.unshift('All')

	const select = d3.select('.team__options')

	const option = select
		.selectAll('option')
		.data(teams)

	option.enter().append('option')
		.text(d => d)

	select.on('change', handleTeamChange)
}

function setupCategories() {
	d3.selectAll('.category__options li')
		.on('click', handleCategoryChange)
}

function setupIntroEvents() {
	chart.selectAll('.description__link').on('click', function click() {
		const sel = d3.select(this)
		const filter = sel.attr('data-filter')
		const value = sel.attr('data-value')
		if (filter === 'player') {
			d3.select('.search__input input').node().value = value
			handleSearchChange.call({ value })
		} else if (filter === 'play') {
			const index = +d3.select(this.parentNode).attr('data-index')
			const item = chart.selectAll('.year')
				.filter((d, i) => i === index)
				.selectAll('.item')
				.filter(d => d.external_video_id === value)

			handlePlayClick.call(item.node(), item.datum())
		}
	})
}

function setupSlider() {
	graphic.selectAll('.year__slider').each((d, i, nodes) => {
		noUiSlider.create(nodes[i], {
			start: 0,
			connect: [true, false],
			step: 1,
			range: { min: 0, max: NUM_VIDEOS - 1 },
		})

		nodes[i].noUiSlider.on('update', function slide() {
			const index = +this.get()
			handleSlider({ decade: d.key, index })
		})
	})
}

function setupDropdown() {
	const select = graphic.select('.era__select')

	select.selectAll('option')
		.data(decades)
		.enter().append('option')
		.text(d => d)
		.attr('value', (d, i) => i)

	select.on('change', handleEraChange)
}

function setup() {
	setupScales()
	Youtube.setup(dataByDecade)
	createChart()
	resize()

	setupSearch()
	setupKey()
	setupCategories()
	setupTitles()
	setupIntroEvents()

	setupSlider()
	setupScroll()
	setupDropdown()

	return Promise.resolve()
}

function init() {
	mobile = d3.select('body').node().offsetWidth < 800
	loadData()
		.then(Youtube.init)
		.then(setup)
		.catch(err => console.log(err))
}

export default { init, resize, jumpToPlay }
