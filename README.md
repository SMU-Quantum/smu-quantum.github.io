# SMU Quantum

The group website uses static HTML and CSS. Edit the research statement, research areas, selected papers and recent highlights in `index.html`. If you rename a research area, update it in both `index.html` and `research.html`. The main pages are `publications.html`, `research.html`, `people.html` and `news.html`. Research code and notebooks are listed in `software.html` and linked from Research. All pages use `styles.css`.

Add papers to the appropriate year in `publications.html`. Set `data-authors` to the space-separated group member keys present in the byline (`lau`, `lee`, `sharma`). `publications.js` uses those keys for the author filter. The full list stays readable without JavaScript.

The organisation’s GitHub profile is maintained in [SMU-Quantum/.github](https://github.com/SMU-Quantum/.github/blob/main/profile/README.md).

To preview locally, open `index.html` in a browser or run `python3 -m http.server 8000` from this directory and open [localhost:8000](http://localhost:8000).

For [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), choose **Deploy from a branch** in **Settings → Pages**, then select **main** and **/(root)**. The organisation site address is [smu-quantum.github.io](https://smu-quantum.github.io/).

## Photo credit

[Singapore Cargo-Terminal-01](https://commons.wikimedia.org/wiki/File:Singapore_Cargo-Terminal-01.jpg), photo by CEphoto, Uwe Aranas. The site uses the 1,280-pixel Wikimedia Commons copy and crops the display at some sizes. The photo is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
