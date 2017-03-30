github:
	rm -rf docs
	cp -r dist/ docs
	git add -A
	git commit -m "update dev version"
	git push

copy-data:
	cp ../google_nba-data/processing/data/curated_merged_by_decade.csv src/assets