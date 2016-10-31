/**
 * Middleware for replaying requests from an HLS session
 */

let M3U8_MIME_TYPE = require('./mime-types').M3U8_MIME_TYPE;

var Decrypter = require('aes-decrypter').Decrypter;

/**
 * Expects an `:index` parameter on the request object and an HLS
 * session to work from as a local on the response object.
 */
function replay(request, response) {
  var content, activeHlsSession;

  activeHlsSession = response.locals.activeHlsSession;
  if (!activeHlsSession ||
      request.params.index < 0 ||
      request.params.index >= activeHlsSession.length) {
    return response.sendStatus(400);
  }

  content = activeHlsSession[request.params.index].response.content;
  response.status(200);
  if (content.encoding && content.encoding === 'base64') {
    if (M3U8_MIME_TYPE.test(content.mimeType)) {
      response.set('Content-Type', 'text/plain');
    } else {
      response.set('Content-Type', content.mimeType);
    }
    return response.send(new Buffer(content.text, 'base64').toString());
  }
  response.send(content.text);
}

function decrypt(request, response, next) {
  var entry, activeHlsSession;
  console.log('decrypting:', request.url);

  activeHlsSession = response.locals.activeHlsSession;
  if (!activeHlsSession ||
      request.params.index < 0 ||
      request.params.index >= activeHlsSession.length) {
    return response.sendStatus(400);
  }

  entry = activeHlsSession[request.params.index];
  try {
    new Decrypter(new Uint8Array(new Buffer(entry.response.content.text, 'base64').buffer),
                  entry.key,
                  entry.iv,
                  function(error, decrypted) {
                    if (error) {
                      return response.sendStatus(400);
                    }
                    response.set('Content-Type', 'video/mp2t');
                    return response.send(Buffer.from(decrypted.buffer));
                  });
  } catch(e) {
    response.status(400);
    response.send(e);
  }
}

module.exports = {
  replay: replay,
  decrypt: decrypt
};
