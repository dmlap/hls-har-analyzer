var TS_MIME_TYPE = /video\/mp2t/i;
var M3U8_MIME_TYPE = /application\/vnd.apple.mpegurl|application\/x-mpegurl/i;

var findHeaderValue = function(headers, name) {
  var header = headers.find(function(header) {
    return header.name === name;
  }) || {};
  return header.value;
};

/**
 * Filter a parsed HAR file for activity related to HLS playback.
 * @param har {object} - a parsed HAR file
 * @return an array of HLS request and responses objects
 * @see http://www.softwareishard.com/blog/har-12-spec/
 */
module.exports = function collectHlsSession(har) {
  return har.log.entries.filter(function(entry) {
    // annotate the response objects with the content type found in
    // the headers
    entry.response.contentType = findHeaderValue(entry.response.headers,
                                                 'Content-Type');

    return entry.request.method === 'GET' &&
      (TS_MIME_TYPE.test(entry.response.contentType) ||
       M3U8_MIME_TYPE.test(entry.response.contentType));
  });
};
