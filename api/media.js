const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';
const MEDIA_FETCH_TIMEOUT_MS = 10000;

function isBlobStorageHost(parsedUrl) {
  if (!parsedUrl) {
    return false;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (parsedUrl.protocol !== 'https:') {
    return false;
  }

  return host === 'public.blob.vercel-storage.com' || host.endsWith(BLOB_HOST_SUFFIX);
}

function parseUrlLenient(urlString) {
  try {
    return new URL(String(urlString || '').trim());
  } catch {
    try {
      return new URL(String(urlString || '').trim(), 'https://placeholder.local');
    } catch {
      return null;
    }
  }
}

function extractBlobSourceUrl(rawValue) {
  let current = typeof rawValue === 'string' ? rawValue.trim() : '';

  for (let depth = 0; depth < 4 && current; depth += 1) {
    const parsed = parseUrlLenient(current);
    if (!parsed) {
      return '';
    }

    if (isBlobStorageHost(parsed)) {
      if (!parsed.pathname || parsed.pathname === '/') {
        return '';
      }

      return parsed.toString();
    }

    const nestedUrl = parsed.searchParams.get('url');
    const isMediaProxyPath = parsed.pathname === '/api/media' || parsed.pathname.endsWith('/api/media');
    if (isMediaProxyPath && nestedUrl) {
      current = nestedUrl.trim();
      continue;
    }

    return '';
  }

  return '';
}

exports.proxyBlobMedia = async (req, res) => {
  const sourceUrl = extractBlobSourceUrl(req.query.url);
  if (!sourceUrl) {
    return res.status(400).json({ error: 'Invalid media URL' });
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), MEDIA_FETCH_TIMEOUT_MS);

  try {
    const upstreamHeaders = {};
    if (req.headers['if-none-match']) {
      upstreamHeaders['if-none-match'] = req.headers['if-none-match'];
    }
    if (req.headers['if-modified-since']) {
      upstreamHeaders['if-modified-since'] = req.headers['if-modified-since'];
    }

    const upstreamResponse = await fetch(sourceUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: abortController.signal
    });

    if (upstreamResponse.status === 304) {
      return res.status(304).end();
    }

    if (!upstreamResponse.ok) {
      const status = upstreamResponse.status === 404 ? 404 : 502;
      return res.status(status).json({ error: 'Failed to fetch media' });
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstreamResponse.headers.get('cache-control') || 'public, max-age=86400';
    const etag = upstreamResponse.headers.get('etag');
    const lastModified = upstreamResponse.headers.get('last-modified');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    if (etag) {
      res.setHeader('ETag', etag);
    }
    if (lastModified) {
      res.setHeader('Last-Modified', lastModified);
    }

    const body = Buffer.from(await upstreamResponse.arrayBuffer());
    return res.status(200).send(body);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Media request timed out' });
    }

    console.error('Media proxy error:', error.message);
    return res.status(502).json({ error: 'Failed to proxy media' });
  } finally {
    clearTimeout(timeoutId);
  }
};
