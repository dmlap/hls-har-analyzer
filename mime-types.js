/**
 * Regular expressions to test for HLS related MIME types.
 */

module.exports = {
  TS_MIME_TYPE: /video\/mp2t/i,
  M3U8_MIME_TYPE: /application\/vnd.apple.mpegurl|application\/x-mpegurl/i,
  KEY_MIME_TYPE: /application\/octet-stream/i
};
