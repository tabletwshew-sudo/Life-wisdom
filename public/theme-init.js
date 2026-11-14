// Apply the saved theme before first paint to avoid a white flash.
try {
  var t = localStorage.getItem('fh-theme') || 'system'
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
} catch {}
