dist: out_chrome := $(abspath bookmarks-chrome.zip)
dist: out_firefox := $(abspath bookmarks-firefox.zip)
dist: dir := app
dist: files := $(wildcard *.js *.css *.html icon*.png _locales *.json)
dist: min := $(filter %.js %.css %.html,$(files))
dist:
	@echo Chrome
	rm -rf $(dir)
	mkdir -p $(dir)
	cp -rt $(dir) $(filter-out $(min),$(files))
	$(foreach i,$(min),minify $(i) > $(dir)/$(i);)
	rm -f $(out_chrome)
	zip -r $(out_chrome) $(dir)
	@echo Firefox
	rm -rf $(dir)
	mkdir -p $(dir)
	rm -f $(out_firefox)
	cp -rt $(dir) $(files)
	cd $(dir) && zip -r -FS $(out_firefox) *
	rm -rf $(dir)
