(function () {
  var slides = document.querySelector('x-slides');

  var qs = queryString.parse(location.search);
  var md = qs.md;

  if (!md) {
    md = 'https://github.com/cvdlab/showdown/blob/master/README.md';
    // return;
  }
  
  md = md.replace('github.com/', 'cdn.rawgit.com/').replace('/blob/', '/');

  superagent.get(md).end(function (res) {
    if (!res.ok) {
      console.error(res);
      return;
    }
    slides.markdown = res.text;
  });

  var plugins = slides.querySelectorAll('[plugin]').array();
  plugins.forEach(function (plugin) {
    plugin.slides = slides;
  });

}());