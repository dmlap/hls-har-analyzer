$('#har-file-input').on('change', function() {
  var formData = new FormData($(this).parents('form')[0]);
  $.ajax({
    url: '/har',
    type: 'POST',
    data: formData,
    processData: false,
    contentType: false
  });
});
