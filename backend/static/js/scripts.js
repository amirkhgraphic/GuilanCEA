// Custom JavaScript for Django Unfold admin
document.addEventListener('DOMContentLoaded', function() {
    // Add confirmation for hard delete actions
    const hardDeleteButtons = document.querySelectorAll('[name="hard_delete"]');
    hardDeleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
                e.preventDefault();
            }
        });
    });
    
    // Auto-resize textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });
});
