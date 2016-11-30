'use strict';

let aes = require('aes-decrypter');
let m3u8 = require('m3u8-parser');
let URL = require('url');

let mimes = require('./mime-types');
let TS_MIME_TYPE = mimes.TS_MIME_TYPE;
let M3U8_MIME_TYPE = mimes.M3U8_MIME_TYPE;
let KEY_MIME_TYPE = mimes.KEY_MIME_TYPE;

let findHeaderValue = function(headers, name) {
  let header = headers.find(function(header) {
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
  let m3u8Parser;
  let result = [];
  let needsKeys = [];
  let lastM3U8;
  let lastKey;
  let decrypter;

  har.log.entries.forEach(function(entry) {
    // annotate the response objects with the content type found in
    // the headers
    entry.response.contentType = findHeaderValue(entry.response.headers,
                                                 'Content-Type');

    if (entry.request.method !== 'GET') {
      return;
    }

    // m3u8s
    if (M3U8_MIME_TYPE.test(entry.response.contentType)) {

      if (!entry.response.content.text) {
        entry.playlistType = 'unavailable';
      } else {
        m3u8Parser = new m3u8.Parser();
        m3u8Parser.push(new Buffer(entry.response.content.text, 'base64').toString());

        // store the active variant playlist
        if (m3u8Parser.manifest.segments) {
          lastM3U8 = m3u8Parser.manifest;
          lastM3U8.uri = entry.request.url;
          entry.playlistType = 'variant';
        } else {
          entry.playlistType = 'master';
        }
      }

      return result.push(entry);
    }

    // TS files
    let matchesTsMimeType = TS_MIME_TYPE.test(entry.response.contentType);
    let segmentIndex;
    let segment;

    // if the request URL matches a segment URL, fix the content type
    // if necessary
    if (lastM3U8) {
      segmentIndex = lastM3U8.segments.findIndex((segment) => {
        return URL.resolve(lastM3U8.uri, segment.uri) === entry.request.url;
      });
      segment = lastM3U8.segments[segmentIndex];
      if (segment) {
        entry.response.contentType = 'video/mp2t';
      }
    }
    if (TS_MIME_TYPE.test(entry.response.contentType)) {

      // annotate the entry with info from the last M3U8
      if (segment) {
        entry.duration = segment.duration || lastM3U8.targetDuration;

        if (segment.key) {
          entry.iv = segment.key.iv || new Uint32Array([
            0, 0, 0,
            lastM3U8.mediaSequence + segmentIndex
          ]);

          if (lastKey) {
            entry.key = lastKey;
          } else {
            needsKeys.push([segment, entry]);
          }
        }
      }

      return result.push(entry);
    }

    // decryption keys
    // if the request matches a key URL, fix the content type if
    // necessary
    if (lastM3U8) {
      let matchesKeyUrl = lastM3U8.segments.filter((segment) => segment.key).find((segment) => {
        return URL.resolve(lastM3U8.uri, segment.key.uri) === entry.request.url;
      });

      if (matchesKeyUrl) {
        entry.response.contentType = 'application/octet-stream';
      }
    }
    if (KEY_MIME_TYPE.test(entry.response.contentType) &&
        entry.response.bodySize === 16) {
      let keyContent;

      if (entry.response.content.text) {
        if (entry.response.content.encoding === 'base64') {
          // correctly captured keys will be base64 encoded
          keyContent = new Buffer(entry.response.content.text, 'base64');
          console.log('b64', entry.response.content.text, keyContent.length);
        } else {
          // the bytes of the key were directly encoded as text
          keyContent = new Buffer(entry.response.content.text, 'binary');
          console.log('text', entry.response.content.text, keyContent.length);
        }

        if (keyContent.length === 16) {
          lastKey = new Uint32Array([
            keyContent.readUInt32BE(0),
            keyContent.readUInt32BE(4),
            keyContent.readUInt32BE(8),
            keyContent.readUInt32BE(12)
          ]);
        }
      }

      // annotate any segments that were missing keys when first
      // encountered
      if (lastM3U8) {
        needsKeys = needsKeys.reduce((result, segmentEntry) => {
          if (lastM3U8 &&
              URL.resolve(lastM3U8.uri, segmentEntry[0].key.uri) === entry.request.url) {
            segmentEntry[1].key = lastKey;
          } else {
            result.push(segmentEntry);
          }
          return result;
        }, []);
      }

      result.push(entry);
    }
  });

  return result;
};
