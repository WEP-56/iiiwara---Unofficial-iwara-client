export function linkifyText(text, { escapeHtml, escapeAttr }) {
  const raw = String(text || '');
  const escaped = escapeHtml(raw);
  const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
  return escaped.replace(urlRe, (url) => {
    const safe = escapeAttr(url);
    return `<a class="ext-link" href="${safe}" data-external-url="${safe}" target="_blank" rel="noreferrer noopener">${safe}</a>`;
  }).replace(/\n/g, '<br>');
}
