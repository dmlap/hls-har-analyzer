'use strict';

/***********
 * General *
 ***********/

// the request-response entries parsed from the input HAR file
var entries;
// a map from entry URLs to more human-friendly labels
var entryLabels;
// the basename of the input HAR
var inputName;
// the jQuery-wrapped primary container
var $main = $('.main');

function indexUrls(entries) {
  var nextSegmentId = 0;
  var nextM3u8Id = 0;
  var nextKeyId = 0;
  var labels = {};

  entries.forEach(function(entry, i) {
    if (!labels[entry.request.url]) {
      if (/video/.test(entry.response.contentType)) {
        labels[entry.request.url] = {
          attr: ['data-segment', nextSegmentId],
          text: 'segment ' + nextSegmentId,
          basename: 'segment-' + nextSegmentId + '.ts'
        };
        nextSegmentId++;
      } else if (/octet-stream/.test(entry.response.contentType)) {
        labels[entry.request.url] = {
          attr: ['data-key', nextKeyId],
          text: 'key ' + nextKeyId,
          basename: 'key-' + nextKeyId
        };
        nextKeyId++;
      } else {
        labels[entry.request.url] = {
          attr: ['data-m3u8', nextM3u8Id],
          text: entry.response.playlistType + ' m3u8 ' + nextM3u8Id,
          basename: 'index-' + nextM3u8Id + '.m3u8'
        };
        nextM3u8Id++;
      }
    }
  });

  return labels;
};

function resolveUrl(base, path) {
  if ((/^[A-z0-9]+:\/\//).test(path)) {
    // absolute URL
    return path;
  }
  if (path.indexOf('//') === 0) {
    // protocol-relative URL
    return base.split('/')[0] + path;
  }
  if (path.indexOf('/') === 0) {
    // domain-relative URL
    return base.split('/').slice(0, 3).join('/') + '/' + path;
  }

  // relative URL
  return base.split('/').slice(0, -1).concat(path).join('/')
}

function domifyM3u8(m3u8) {
  var result = document.createElement('div');
  result.className = 'm3u8';

  if (m3u8.segments) {
    result.appendChild(domifyM3u8Segments(m3u8));
  }
  if (m3u8.playlists) {
    result.appendChild(domifyM3u8Playlists(m3u8));
  }

  return result;
}

function domifyM3u8Segments(m3u8) {
  var result = document.createDocumentFragment();
  var heading = document.createElement('h4');
  var timeline = m3u8.discontinuitySequence || 0;
  var segments;

  heading.appendChild(document.createTextNode('Segments:'));
  result.appendChild(heading);

  segments = document.createElement('ol');
  segments.className = 'segments';
  m3u8.segments.forEach(function(segment, i) {
    var li = document.createElement('li');
    var label = entryLabels[resolveUrl(m3u8.uri, segment.uri)];

    if (label) {
      li.appendChild(document.createTextNode(label.text));
    } else {
      li.appendChild(document.createTextNode('unavailable segment'));
      li.classList.add('unavailable');
    }
    if (segment.timeline !== timeline) {
      li.classList.add('discontinuity');
      timeline = segment.timeline;
    }
    if (segment.key) {
      li.classList.add('encrypted');
    }
    if (segment.duration) {
      li.appendChild(document.createTextNode(', ' + segment.duration + ' seconds'));
    }

    segments.appendChild(li);
  });
  result.appendChild(segments);

  return result;
}

function domifyM3u8Playlists(m3u8) {
  var result = document.createDocumentFragment();
  var heading = document.createElement('h4');
  var playlists;
  var text;

  heading.appendChild(document.createTextNode('Playlists:'));
  result.appendChild(heading);

  playlists = document.createElement('ol');
  playlists.className = 'playlists';
  m3u8.playlists.forEach(function(playlist) {
    var li = document.createElement('li');
    var label = entryLabels[resolveUrl(m3u8.uri, playlist.uri)];

    if (label) {
      li.appendChild(document.createTextNode(label.text));
    } else {
      li.appendChild(document.createTextNode('unavailable playlist'));
      li.classList.add('unavailable');
    }

    if (playlist.attributes) {
      text = [];
      if (playlist.attributes.BANDWIDTH) {
        text.push((playlist.attributes.BANDWIDTH / 1024).toFixed(0) + ' kbps');
      }
      if (playlist.attributes.RESOLUTION) {
        text.push(playlist.attributes.RESOLUTION.width
                  + 'x'
                  + playlist.attributes.RESOLUTION.width);
      }
    }
    li.appendChild(document.createTextNode(' (' + text.join(', ') + ')'));

    playlists.appendChild(li);
  });
  result.appendChild(playlists);

  return result;
}

/**************
 * Navigation *
 **************/

$main.on('entrieschange', function() {
  $('.input-name').text('Analyzing: ' + inputName);
});

/*********
 * Input *
 *********/

var $fileInput = $('#har-file-input');
var $form = $fileInput.parents('form');
var $formGroup = $fileInput.parents('form-group');
var $formStatus = $form.find('.status');

// HAR Input
$fileInput.on('change', function() {
  var formData = new FormData($form[0]);

  $formStatus.empty();
  $formGroup.removeClass('has-error');
  inputName = $fileInput.val().split('\\').splice(-1)[0];

  $.ajax({
    url: '/har',
    type: 'POST',
    data: formData,
    processData: false,
    contentType: false,

    error: function(xhr, textStatus) {
      $formGroup.addClass('has-error');

      $formStatus
        .html('Oops! Something went wrong:<br><small><code>' +
              xhr.responseText +
              '</code></small>')
        .removeClass('hidden')
        .addClass('bg-danger');
    },
    success: function(data) {
      entries = data;
      $main
        .removeClass('awaiting-input')
        .trigger('entrieschange');
    }
  });
});

/************
 * Analysis *
 ************/

// ---- Entry Index ---- //

function buildEntryList(entries) {
  var list = document.createElement('ol');

  entryLabels = indexUrls(entries);

  list.className = 'list-group har-entries';

  entries.forEach(function(entry, i) {
    var li = document.createElement('li');
    li.setAttribute.apply(li, entryLabels[entry.request.url].attr);
    li.setAttribute('data-index', i);
    li.setAttribute('data-basename', entryLabels[entry.request.url].basename);

    li.appendChild(document.createTextNode(entryLabels[entry.request.url].text));
    li.setAttribute('title', entry.request.url);

    li.className = 'list-group-item';
    if (entry.response.status >= 500) {
      li.className += ' list-group-item-danger';
    } else if (entry.response.status >= 400) {
      li.className += ' list-group-item-warning';
    } else if (entry.response.status >= 300) {
      li.className += ' list-group-item-info';
    }

    $(li).data('entry', entry);

    list.appendChild(li);
  });

  return list;
}

function renderHar() {
  var fragment = document.createDocumentFragment();
  var entryList = buildEntryList(entries);
  var $entryList = $(entryList);
  var $selectedEntry;
  fragment.appendChild(entryList);

  $('.analysis .har-entries').replaceWith(fragment);
  $entryList.on('click', function(event) {
    var $target = $(event.target);
    var $row;

    if (!$target.is('.list-group-item')) {
      return;
    }

    $row = $target;

    if ($selectedEntry) {
      $selectedEntry.removeClass('active');
    }
    $row.addClass('active');
    $selectedEntry = $row;

    $main.addClass('viewing-entry');
    $main.trigger('selectionchange');
  });

  $main.trigger('entriesready');
}

$main.on('entrieschange', renderHar);

$main.on('unselect', function() {
  $main.find('.har-entries .active').removeClass('active');
  $main.removeClass('viewing-entry');
});

// ---- Overview and Entry Panes ---- //

var $startSegment = $('.start-segment');
var $endSegment = $('.end-segment');

// Overview Pane
function applyFilter() {
  var start = parseInt($startSegment.val(), 10);
  var end = parseInt($endSegment.val(), 10);

  var $entryList = $('.har-entries');
  var $start = $entryList.find('[data-segment=' + start + ']');
  var $end = $entryList.find('[data-segment=' + end + ']');

  if (start === 0) {
    $start.prevAll().andSelf().removeClass('hidden');
  } else {
    $start.prevAll().addClass('hidden');
  }
  $start.nextUntil($end).andSelf().add($end).removeClass('hidden');
  $end.nextAll().addClass('hidden');

  var url = window.location.origin + '/m3u8/' + start + '-' + end;
  $('.replay-src').attr('href', url).text(url);
}

function updateFilter() {
  var max = parseInt($('tr[data-segment]').last().attr('data-segment'), 10);

  $endSegment.val(max)
    .add($startSegment)
      .attr('max', max)
      .removeAttr('disabled');
}

$main.on('entriesready', updateFilter);
$startSegment.add($endSegment).on('change', applyFilter);

// Entry Pane
var $entryPane = $('.entry-pane');
var entryRequest;

function renderM3u8(url) {
  entryRequest = $.get(url, function(m3u8) {
    var parser = new m3u8Parser.Parser();
    parser.push(m3u8);
    $entryPane.find('.response-details .ready').html(domifyM3u8(parser.manifest));
    $entryPane.find('.response-details').addClass('ready');
  });
}

function renderEntry() {
  var $selectedEntry = $('.har-entries .active');
  var entry = $selectedEntry.data('entry');
  var index = $selectedEntry.attr('data-index');
  var replayUrl = '/replay/' + index
      + '/' + $selectedEntry.attr('data-basename');
  var splitUrl;

  $entryPane.find('.response-details').removeClass('ready');

  $entryPane.find('.download a')
    .attr('href', replayUrl);
  if (entry.response.encrypted) {
    replayUrl = '/decrypt/' + index
      + '/' + $selectedEntry.attr('data-basename');
    $entryPane.find('.download-decrypted')
      .removeClass('disabled')
      .find('a').attr('href', replayUrl);
  } else {
    $entryPane.find('.download-decrypted').addClass('disabled');
  }

  splitUrl = entry.request.url.split('/');
  $entryPane.find('.original-url')
    .html('<a href="' + entry.request.url + '">'
          + (splitUrl.slice(0, 3)
             .concat('&hellip;')
             .concat(splitUrl.slice(-1))
             .join('/'))
          + '</a>');
  $entryPane.find('.http-status')
    .html(entry.response.status);
  $entryPane.find('.body-size')
    .html(entry.response.bodySize + 'B');

  if (entry.response.contentType.indexOf('mpeg') > 0) {
    renderM3u8(replayUrl);
  } else if (entry.response.contentType.indexOf('video') === 0) {
    console.log('trying to render a segment');
  }
}

$main.on('selectionchange', renderEntry);

$entryPane.find('.close').on('click', function() {
  $main.trigger('unselect');
});
