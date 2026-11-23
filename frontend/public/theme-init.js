// Apply the saved theme before the page renders. Dark is the brand default.
;(function () {
  try {
    if (localStorage.getItem('restoflow.theme') === 'light') {
      document.documentElement.dataset.theme = 'light'
      var meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', '#f8f5ef')
    }
  } catch (e) {
    /* storage unavailable: keep the default */
  }
})()
