'use strict';

/***********
 * General *
 ***********/

var entries;
var inputName;
var $main = $('.main');

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

function buildTable(entries) {
  var table = document.createElement('table');
  var tableHead = document.createElement('thead');
  var tableBody = document.createElement('tbody');

  var labels = indexUrls(entries);
  var lastKey;

  table.className = 'table table-hover table-condensed har-entries';
  tableHead.innerHTML = '<tr><th>' + [
    'Name',
    'Status',
    'Size'
  ].join('</th><th>') + '</th></tr>';
  table.appendChild(tableHead);
  table.appendChild(tableBody);

  entries.forEach(function(entry, i) {
    var row = document.createElement('tr');
    row.setAttribute.apply(row, labels[entry.request.url].attr);
    row.setAttribute('data-index', i);
    row.setAttribute('data-basename', labels[entry.request.url].basename);

    row.innerHTML = '<td>' + [
      '<a href="/replay/' + i + '/' + labels[entry.request.url].basename
        + '" title="' + entry.request.url + '" target="_blank">'
        + labels[entry.request.url].text + '</a>',
      entry.response.status,
      entry.response.bodySize
    ].join('</td><td>') + '</td>';

    $(row).data('entry', entry);

    tableBody.appendChild(row);
  });

  return table;
}

function renderHar() {
  var fragment = document.createDocumentFragment();
  var table = buildTable(entries);
  var $table = $(table);
  var $selectedRow;
  fragment.appendChild(table);

  $('.analysis .har-entries').replaceWith(fragment);
  $table.on('click', function(event) {
    var $target = $(event.target);
    var $row;

    if (!$target.is('a')) {
      return;
    }

    event.preventDefault();
    $row = $target.parents('tr');

    if ($selectedRow) {
      $selectedRow.removeClass('info');
    }
    $row.addClass('info');
    $selectedRow = $row;

    $main.addClass('viewing-entry');
    $main.trigger('selectionchange');
  });

  $main.trigger('entriesready');
}

$main.on('entrieschange', renderHar);

$main.on('unselect', function() {
  $main.find('.har-entries .info').removeClass('info');
  $main.removeClass('viewing-entry');
});

// ---- Overview and Entry Panes ---- //

var $startSegment = $('.start-segment');
var $endSegment = $('.end-segment');

// Overview Pane
function applyFilter() {
  var start = parseInt($startSegment.val(), 10);
  var end = parseInt($endSegment.val(), 10);

  var $table = $('.har-entries');
  var $start = $table.find('[data-segment=' + start + ']');
  var $end = $table.find('[data-segment=' + end + ']');

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

$main.on('selectionchange', function() {
  var $selectedRow = $('.har-entries .info');
  var entry = $selectedRow.data('entry');
  var index = $selectedRow.attr('data-index');

  $entryPane.find('.original-url')
    .html('<a href="' + entry.request.url + '">' + entry.request.url +'</a>');
  $entryPane.find('.download a')
    .attr('href', '/replay/' + index
          + '/' + $selectedRow.attr('data-basename'));

  if (entry.response.encrypted) {
    $entryPane.find('.download-decrypted')
      .removeClass('disabled')
      .find('a').attr('href', '/decrypt/' + index
                      + '/' + $selectedRow.attr('data-basename'));
  } else {
    $entryPane.find('.download-decrypted').addClass('disabled');
  }
});

$entryPane.find('.close').on('click', function() {
  $main.trigger('unselect');
});
