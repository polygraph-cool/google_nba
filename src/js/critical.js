import { loadFontGroup } from './utils/load-font'

const ptSerif = [
	{
		family: 'PT Serif',
		weight: 400,
	},
	{
		family: 'PT Serif',
		weight: 700,
	},
]

const roboto = [
	{
		family: 'Roboto',
		weight: 100,
	},
	{
		family: 'Roboto',
		weight: 300,
	},
	{
		family: 'Roboto',
		weight: 700,
	},
]

loadFontGroup(ptSerif)
loadFontGroup(roboto)
