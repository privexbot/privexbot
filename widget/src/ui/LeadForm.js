/**
 * LeadForm - Lead collection form component
 */

class LeadForm {
  constructor(config, onSubmit, onSkip) {
    this.config = config || {};
    this.onSubmit = onSubmit;
    this.onSkip = onSkip;
    this.element = null;
    this.errors = {};
  }

  render() {
    const container = document.createElement('div');
    container.className = 'privexbot-lead-form';

    const fields = this.config.fields || [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: false },
      { name: 'company', label: 'Company', type: 'text', required: false },
    ];

    const fieldsHtml = fields
      .map(
        (field) => `
      <div class="privexbot-form-group">
        <label class="privexbot-form-label" for="privexbot-${field.name}">
          ${field.label}${field.required ? ' *' : ''}
        </label>
        <input
          type="${field.type}"
          id="privexbot-${field.name}"
          name="${field.name}"
          class="privexbot-form-input"
          ${field.required ? 'required' : ''}
          placeholder="${field.placeholder || ''}"
        />
        <div class="privexbot-form-error" id="error-${field.name}"></div>
      </div>
    `
      )
      .join('');

    container.innerHTML = `
      <h3>${this.config.title || 'Get in Touch'}</h3>
      <p>${this.config.description || "We'd love to hear from you! Please share your details."}</p>
      <form id="privexbot-lead-form">
        ${fieldsHtml}
        <button type="submit" class="privexbot-form-submit">
          ${this.config.submitText || 'Continue'}
        </button>
        ${
          this.config.allowSkip !== false
            ? `<button type="button" class="privexbot-form-skip">
                Skip for now
              </button>`
            : ''
        }
      </form>
    `;

    this.element = container;
    this.attachEventListeners(fields);

    return container;
  }

  attachEventListeners(fields) {
    const form = this.element.querySelector('#privexbot-lead-form');
    const skipBtn = this.element.querySelector('.privexbot-form-skip');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(fields);
    });

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (this.onSkip) {
          this.onSkip();
        }
      });
    }

    // Real-time validation
    fields.forEach((field) => {
      const input = this.element.querySelector(`#privexbot-${field.name}`);
      if (input) {
        input.addEventListener('blur', () => {
          this.validateField(field, input.value);
        });

        input.addEventListener('input', () => {
          // Clear error on input
          this.clearError(field.name);
        });
      }
    });
  }

  handleSubmit(fields) {
    this.errors = {};
    const formData = {};
    let isValid = true;

    // Validate all fields
    fields.forEach((field) => {
      const input = this.element.querySelector(`#privexbot-${field.name}`);
      const value = input ? input.value.trim() : '';
      formData[field.name] = value;

      if (!this.validateField(field, value)) {
        isValid = false;
      }
    });

    if (isValid && this.onSubmit) {
      // Disable submit button
      const submitBtn = this.element.querySelector('.privexbot-form-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      this.onSubmit(formData)
        .then(() => {
          // Success handled by parent
        })
        .catch((error) => {
          // Re-enable button on error
          submitBtn.disabled = false;
          submitBtn.textContent = this.config.submitText || 'Continue';
          alert(error.message || 'Failed to submit. Please try again.');
        });
    }
  }

  validateField(field, value) {
    const errorEl = this.element.querySelector(`#error-${field.name}`);

    // Required validation
    if (field.required && !value) {
      this.errors[field.name] = `${field.label} is required`;
      if (errorEl) {
        errorEl.textContent = this.errors[field.name];
      }
      return false;
    }

    // Email validation
    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        this.errors[field.name] = 'Please enter a valid email';
        if (errorEl) {
          errorEl.textContent = this.errors[field.name];
        }
        return false;
      }
    }

    // Phone validation (basic)
    if (field.type === 'tel' && value) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
        this.errors[field.name] = 'Please enter a valid phone number';
        if (errorEl) {
          errorEl.textContent = this.errors[field.name];
        }
        return false;
      }
    }

    // Clear error if valid
    if (errorEl) {
      errorEl.textContent = '';
    }
    return true;
  }

  clearError(fieldName) {
    const errorEl = this.element.querySelector(`#error-${fieldName}`);
    if (errorEl) {
      errorEl.textContent = '';
    }
    delete this.errors[fieldName];
  }
}

export default LeadForm;
