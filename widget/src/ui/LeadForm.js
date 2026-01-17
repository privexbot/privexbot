/**
 * LeadForm - Lead collection form component
 *
 * Supports both old and new config formats:
 * - Old: fields as array of { name, label, type, required }
 * - New: fields as { email: 'required'|'optional'|'hidden', name: ..., phone: ... }
 *        with custom_fields as separate array
 */

class LeadForm {
  constructor(config, onSubmit, onSkip) {
    this.config = config || {};
    this.onSubmit = onSubmit;
    this.onSkip = onSkip;
    this.element = null;
    this.errors = {};
  }

  /**
   * Build form fields from config
   * Handles both old (array) and new (object with visibility) formats
   */
  buildFormFields() {
    const configFields = this.config.fields;

    // Old format: array of field objects
    if (Array.isArray(configFields)) {
      return configFields.length > 0
        ? configFields
        : [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
          ];
    }

    // New format: StandardFieldsConfig object
    const fields = [];

    // Add standard fields based on visibility
    if (configFields?.email !== 'hidden') {
      fields.push({
        name: 'email',
        label: 'Email',
        type: 'email',
        required: configFields?.email === 'required',
        placeholder: 'Enter your email',
      });
    }

    if (configFields?.name !== 'hidden') {
      fields.push({
        name: 'name',
        label: 'Name',
        type: 'text',
        required: configFields?.name === 'required',
        placeholder: 'Enter your name',
      });
    }

    if (configFields?.phone !== 'hidden') {
      fields.push({
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        required: configFields?.phone === 'required',
        placeholder: 'Enter your phone number',
      });
    }

    // Add custom fields
    const customFields = this.config.custom_fields || [];
    customFields.forEach((cf) => {
      fields.push({
        name: cf.name,
        label: cf.label,
        type: cf.type === 'phone' ? 'tel' : cf.type || 'text',
        required: cf.required || false,
        placeholder: cf.placeholder || '',
        options: cf.options, // For select fields
      });
    });

    // Fallback: at least require email
    if (fields.length === 0) {
      fields.push({
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        placeholder: 'Enter your email',
      });
    }

    return fields;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'privexbot-lead-form';

    const fields = this.buildFormFields();

    const fieldsHtml = fields
      .map((field) => {
        // Handle select fields
        if (field.type === 'select' && field.options) {
          const optionsHtml = field.options
            .map((opt) => `<option value="${opt}">${opt}</option>`)
            .join('');
          return `
            <div class="privexbot-form-group">
              <label class="privexbot-form-label" for="privexbot-${field.name}">
                ${field.label}${field.required ? ' *' : ''}
              </label>
              <select
                id="privexbot-${field.name}"
                name="${field.name}"
                class="privexbot-form-input"
                ${field.required ? 'required' : ''}
              >
                <option value="">Select ${field.label.toLowerCase()}</option>
                ${optionsHtml}
              </select>
              <div class="privexbot-form-error" id="error-${field.name}"></div>
            </div>
          `;
        }
        // Regular input fields
        return `
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
        `;
      })
      .join('');

    // Consent checkbox (GDPR compliance)
    const privacy = this.config.privacy || {};
    const requireConsent = privacy.require_consent || false;
    const consentMessage =
      privacy.consent_message ||
      'I agree to the collection and processing of my data.';

    const consentHtml = requireConsent
      ? `
      <div class="privexbot-form-group privexbot-consent-group">
        <label class="privexbot-consent-label">
          <input
            type="checkbox"
            id="privexbot-consent"
            name="consent"
            class="privexbot-consent-checkbox"
            required
            checked
          />
          <span>${consentMessage}</span>
        </label>
        <div class="privexbot-form-error" id="error-consent"></div>
      </div>
    `
      : '';

    // Support both old (allowSkip) and new (allow_skip) config
    const allowSkip =
      this.config.allow_skip !== undefined
        ? this.config.allow_skip
        : this.config.allowSkip !== false;

    container.innerHTML = `
      <h3>${this.config.title || 'Get in Touch'}</h3>
      <p>${this.config.description || "We'd love to hear from you! Please share your details."}</p>
      <form id="privexbot-lead-form">
        ${fieldsHtml}
        ${consentHtml}
        <button type="submit" class="privexbot-form-submit">
          ${this.config.submitText || 'Continue'}
        </button>
        ${
          allowSkip
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

    // Handle consent checkbox
    const privacy = this.config.privacy || {};
    const requireConsent = privacy.require_consent || false;
    const consentCheckbox = this.element.querySelector('#privexbot-consent');

    if (requireConsent) {
      if (!consentCheckbox || !consentCheckbox.checked) {
        this.errors.consent = 'You must agree to continue';
        const errorEl = this.element.querySelector('#error-consent');
        if (errorEl) {
          errorEl.textContent = this.errors.consent;
        }
        isValid = false;
      }
    }

    // Include consent_given in form data
    // Only true if checkbox exists and is checked, otherwise false
    formData.consent_given = consentCheckbox ? consentCheckbox.checked : false;

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
