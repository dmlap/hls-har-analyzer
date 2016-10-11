var $fileInput = $('#har-file-input');
var $form = $fileInput.parents('form');
var $formGroup = $fileInput.parents('form-group');
var $formStatus = $form.find('.status');

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

      table.className = 'table table-hover table-condensed';
      tableHead.innerHTML = '<tr><th>' + [
        'Name',
        'Method',
        'Status',
        'Type',
        'Size'
      ].join('</th><th>') + '</th></tr>';
      table.appendChild(tableHead);
      table.appendChild(tableBody);
      fragment.appendChild(table);

      entries.forEach(function(entry) {
        var row = document.createElement('tr');
        row.innerHTML = '<td>' + [
          entry.request.url,
          entry.request.method,

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
