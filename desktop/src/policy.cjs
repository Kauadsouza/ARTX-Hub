'use strict';

const HUB_URL = 'https://artx-hub.vercel.app/';
const HUB_ORIGIN = new URL(HUB_URL).origin;
const STUDY_ORIGIN = 'https://sat-simulado.vercel.app';
const WORKSPACE_ORIGINS = new Set([
  HUB_ORIGIN, STUDY_ORIGIN, 'https://sistema-videos.vercel.app',
  'https://university-path-six.vercel.app', 'https://kauaartx.vercel.app',
]);

function secureURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch { return null; }
}

function isHub(value) { return secureURL(value)?.origin === HUB_ORIGIN; }
function isWorkspace(value) { return WORKSPACE_ORIGINS.has(secureURL(value)?.origin); }
function canNavigate(value, mainFrame) {
  return mainFrame ? isHub(value) : value === 'about:blank' || isWorkspace(value);
}
function externalTarget(value) {
  // Só HTTPS, sem exceção. Nenhum protocolo próprio de aplicativo local é
  // despachado daqui: cada exceção numa lista de permissão é superfície de
  // ataque, e esta lista não tem nenhuma.
  return secureURL(value)?.href ?? null;
}
function canDownload(value) {
  if (isWorkspace(value)) return true;
  // Exports created by the authorised workspace retain their creator origin.
  return value.startsWith('blob:') && isWorkspace(value.slice(5));
}
function canRequestAudio(permission, origin, mediaTypes) {
  return permission === 'media' && secureURL(origin)?.origin === STUDY_ORIGIN
    && Array.isArray(mediaTypes) && mediaTypes.length === 1 && mediaTypes[0] === 'audio';
}

module.exports = { HUB_URL, STUDY_ORIGIN, isHub, isWorkspace, canNavigate, externalTarget, canDownload, canRequestAudio };
