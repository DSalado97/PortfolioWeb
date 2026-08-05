// En local se usa la API del mismo servidor; fuera de local se usa Render.
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
window.PORTFOLIO_API_BASE_URL = localHosts.has(window.location.hostname)
  ? ''
  : 'https://portfolio-web-daniel.onrender.com';
