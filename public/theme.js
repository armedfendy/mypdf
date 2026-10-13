(function () {
  var KEY = 'mypdf-theme';
  var root = document.documentElement;

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'dark' ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var label =
      theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-label', label);
      btns[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  apply(read());

  document.addEventListener('DOMContentLoaded', function () {
    apply(read());
    document.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('[data-theme-toggle]') : null;
      if (!btn) return;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch (err) {}
      apply(next);
    });
  });
})();
