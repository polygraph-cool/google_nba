github:
	rm -rf docs
	cp -r dist/ docs
	git add -A
	git commit -m "update dev version"
	git push

copy-data:
	cp ../google_nba-data/processing/data/web.csv src/assets/plays.csv