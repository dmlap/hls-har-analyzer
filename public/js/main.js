'use strict';

var $fileInput = $('#har-file-input');
var $form = $fileInput.parents('form');
var $formGroup = $fileInput.parents('form-group');
var $formStatus = $form.find('.status');

function indexUrls(entries) {
  var nextSegmentId = 0;
  var nextM3u8Id = 0;
  var nextKeyId = 0;
  var labels = {};

  entries.forEach(function(entry, i) {
    if (!labels[entry.request.url]) {
      if (/video/.test(entry.response.contentType)) {
        labels[entry.request.url] = {
          text: 'segment ' + nextSegmentId,
          basename: 'segment-' + nextSegmentId + '.ts'
        };
        nextSegmentId++;
      } else if (/octet-stream/.test(entry.response.contentType)) {
        labels[entry.request.url] = {
          text: 'key ' + nextKeyId,
          basename: 'key-' + nextKeyId
        };
        nextKeyId++;
      } else {
        labels[entry.request.url] = {
          text: 'm3u8 ' + nextM3u8Id,
          basename: 'index-' + nextM3u8Id + '.m3u8'
        };
        nextM3u8Id++;
      }
    }
  });

  return labels;
};

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
    success: function(entries, textStatus, xhr) {
      var fragment = document.createDocumentFragment();
      var table = document.createElement('table');
      var tableHead = document.createElement('thead');
      var tableBody = document.createElement('tbody');

      var labels = indexUrls(entries);
      var lastKey;

      table.className = 'table table-hover table-condensed';
      tableHead.innerHTML = '<tr><th>' + [
        'Name',
        'Decrypted',
        'Status',
        'Type',
        'Size'
      ].join('</th><th>') + '</th></tr>';
      table.appendChild(tableHead);
      table.appendChild(tableBody);
      fragment.appendChild(table);

      entries.forEach(function(entry, i) {
        var row = document.createElement('tr');

        row.innerHTML = '<td>' + [
          '<a href="/replay/' + i + '/' + labels[entry.request.url].basename
            + '" title="' + entry.request.url + '" target="_blank">'
            + labels[entry.request.url].text + '</a>',

          entry.response.encrypted ? '<a href="/decrypt/' + i + '/' + labels[entry.request.url].basename
            + '" title="' + entry.request.url + '" target="_blank">' +
            'decrypted</a>' : '',

          entry.response.status,
          entry.response.contentType,
          entry.response.bodySize
        ].join('</td><td>') + '</td>';

        tableBody.appendChild(row);
      });

      $('.results')
        .empty()
        .html(fragment);
    }
  });
});
