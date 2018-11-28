index.html: index.md
	pandoc -s -f markdown -t html < index.md > index.html
