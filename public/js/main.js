'use strict';

var $fileInput = $('#har-file-input');
var $form = $fileInput.parents('form');
var $formGroup = $fileInput.parents('form-group');
var $formStatus = $form.find('.status');

var $startSegment = $('.start-segment');
var $endSegment = $('.end-segment');

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
    'Decrypted',
    'Status',
    'Size'
  ].join('</th><th>') + '</th></tr>';
  table.appendChild(tableHead);
  table.appendChild(tableBody);

  entries.forEach(function(entry, i) {
    var row = document.createElement('tr');
    row.setAttribute.apply(row, labels[entry.request.url].attr);

    row.innerHTML = '<td>' + [
      '<a href="/replay/' + i + '/' + labels[entry.request.url].basename
        + '" title="' + entry.request.url + '" target="_blank">'
        + labels[entry.request.url].text + '</a>',

      entry.response.encrypted ? '<a href="/decrypt/' + i + '/' + labels[entry.request.url].basename
        + '" title="' + entry.request.url + '" target="_blank">' +
        'decrypted</a>' : '',

      entry.response.status,
      entry.response.bodySize
    ].join('</td><td>') + '</td>';

    tableBody.appendChild(row);
  });

  return table;
}

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

function renderHar(entries) {
  var fragment = document.createDocumentFragment();
  var table = buildTable(entries);
  fragment.appendChild(table);

  $('.results .har-entries').remove();
  $('.results').append(fragment);
  updateFilter();
}


// Segment Filter
$startSegment.add($endSegment).on('change', applyFilter);

// HAR Input
$fileInput.on('change', function() {
  var formData = new FormData($form[0]);

  $formStatus.empty();
  $formGroup.removeClass('has-error');

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
    success: renderHar
  });
});
