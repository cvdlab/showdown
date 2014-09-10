var slides = document.getElementById('slides');

var start = function () {
  var qs = queryString.parse(location.search);
  var md = qs.md;

  if (!md) {
    return;
  }
  
  md = md.replace('github.com/', 'cdn.rawgit.com/')
    .replace('/blob/', '/')

  superagent
    .get(md)
    .end(function (res) {
      window.res = res;
      if (res.ok) {
        console.log(res.text)
        slides.markdown = res.text;
      }
    });
};

start();