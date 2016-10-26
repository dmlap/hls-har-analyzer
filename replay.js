/**
 * Middleware for replaying requests from an HLS session
 */

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
    if ((/mpeg/).test(content.mimeType)) {
      response.set('Content-Type', 'text/plain');
    } else {
      response.set('Content-Type', content.mimeType);
    }
    return response.send(new Buffer(content.text, 'base64').toString());
  }
  response.send(content.text);
}

function decrypt(request, response, next) {
  var ints = '0x0000000000000000000000000008E620'
      .match(/^0?x?(.{8})(.{8})(.{8})(.{8})/i);
  var iv = new Uint32Array([
    parseInt(ints[1], 16),
    parseInt(ints[2], 16),
    parseInt(ints[3], 16),
    parseInt(ints[4], 16)
  ]);
  var entry, activeHlsSession;

  activeHlsSession = response.locals.activeHlsSession;
  if (!activeHlsSession ||
      request.params.index < 0 ||
      request.params.index >= activeHlsSession.length) {
    return response.sendStatus(400);
  }

  entry = activeHlsSession[request.params.index];
  new Decrypter(new Uint8Array(new Buffer(entry.response.content.text, 'base64').buffer),
                entry.key,
                iv,
                function(error, decrypted) {
                  if (error) {
                    return response.sendStatus(400);
                  }
                  response.set('Content-Type', 'video/mp2t');
                  return response.send(Buffer.from(decrypted.buffer));
                });
}

module.exports = {
  replay: replay,
  decrypt: decrypt
};
