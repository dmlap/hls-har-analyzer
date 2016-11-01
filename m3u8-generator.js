/**
 * Middleware that creates a representative VOD HLS playlist from an
 * HLS session.
 */

let TS_MIME_TYPE = require('./mime-types').TS_MIME_TYPE;

function generate(segments, start, end) {
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-TARGETDURATION:10'
  ].concat(segments.slice(start, end).map(function(segment, i) {
    return '#EXTINF:' + (segment[1].duration || 10) + ',\n/'
      + (segment[1].key ? 'decrypt' : 'replay')
      + '/' + (segment[0]) + '/segment.ts';
  })).concat('#EXT-X-ENDLIST\n').join('\n');
};

/**
 * Expects `:start` and `:end` parameters on the request object that
 * specify the inclusive start index and exclusive end index for the
 * M3U8 to generate. Also, an HLS session to work from as a local on
 * the response object.
 */
function replayPlaylist(request, response, next) {
  let activeHlsSession = response.locals.activeHlsSession;

  let segments = activeHlsSession.reduce((result, entry, i) => {
    if (TS_MIME_TYPE.test(entry.response.contentType)) {
      result.push([i, entry]);
    }
    return result;
  }, []);
  let start = Math.max(parseInt(request.params.start, 10), 0);
  let end;

  if (request.params.end) {
    end = Math.min(parseInt(request.params.end, 10), segments.length);
  } else {
    end = segments.length;
  }

  response.status(200);
  response.set('Content-Type', 'application/x-mpegURL');
  return response.send(generate(segments, start, end));
}

module.exports = replayPlaylist;
