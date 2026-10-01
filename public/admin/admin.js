(() => {
  const byId = (id) => document.getElementById(id);
  const state = {
    xml: null,
    pictures: [],
    dirty: false,
    recordEditing: null,
    recordKind: null,
    eventEditing: null,
    eventDraft: null,
    eventIsNew: false,
    eventKind: 'event',
    pendingEventPicture: null,
    pendingPictureDeletions: new Set(),
    pictureUploading: false,
    dutyEditing: null,
    dutyIsNew: false
  };

  const status = (message, kind = 'info') => {
    const element = byId('status-message');
    element.textContent = message;
    element.dataset.state = kind;
  };

  const markDirty = () => {
    state.dirty = true;
    byId('save-data').disabled = false;
    status('You have unsaved changes.', 'dirty');
  };

  const createButton = (label, className, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${className}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };

  const setEmptyState = (container, message) => {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = message;
    container.append(empty);
  };

  const eventNodes = () => Array.from(state.xml.querySelectorAll('Events > Event'));
  const dutyNodes = () => Array.from(state.xml.querySelectorAll('Duties > Duty'));

  async function loadData(discardChanges = false) {
    if (state.dirty && !discardChanges && !window.confirm('Discard your unsaved changes and reload data.xml?')) return;

    byId('reload-data').disabled = true;
    byId('save-data').disabled = true;
    status('Loading data.xml...');
    try {
      const response = await fetch(`/xml-data/data.xml?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Could not load data.xml (${response.status}).`);

      const source = await response.text();
      const xml = new DOMParser().parseFromString(source, 'application/xml');
      if (xml.querySelector('parsererror') || !xml.documentElement || xml.documentElement.nodeName !== 'Record') {
        throw new Error('data.xml is not valid XML with a Record root element.');
      }

      state.xml = xml;
      state.dirty = false;
      renderLists();
      const pictureError = await loadPictures();
      status(pictureError || `Loaded ${eventNodes().length} events, ${state.xml.querySelectorAll('Charities > Charity').length} charities, and ${dutyNodes().length} duties.`,
        pictureError ? 'error' : 'info');
      return true;
    } catch (error) {
      status(error.message || 'Could not load data.xml.', 'error');
      return false;
    } finally {
      byId('reload-data').disabled = false;
      byId('save-data').disabled = !state.dirty;
    }
  }

  function renderLists() {
    renderRecordTexts('Description');
    renderRecordTexts('Mission');
    renderEvents();
    renderCharities();
    renderDuties();
  }

  function recordTextNodes(name) {
    return Array.from(state.xml.documentElement.children).filter((child) => child.tagName === name);
  }

  function renderRecordTexts(name) {
    const list = byId(name === 'Description' ? 'descriptions-list' : 'missions-list');
    list.replaceChildren();
    const nodes = recordTextNodes(name);
    if (!nodes.length) {
      setEmptyState(list, `No ${name.toLowerCase()}s yet.`);
      return;
    }

    nodes.forEach((node) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const preview = document.createElement('p');
      preview.className = 'row-copy';
      preview.textContent = node.textContent.trim().replace(/\s+/g, ' ') || '(empty)';
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('View', 'btn-turquoise', () => showItem(name, elementEditorValue(node))),
        createButton('Edit', 'btn-turquoise', () => openRecordTextEditor(name, node)),
        createButton('Delete', 'btn-danger', () => deleteRecordText(name, node))
      );
      row.append(preview, actions);
      list.append(row);
    });
  }

  function showItem(title, content) {
    byId('item-view-title').textContent = title;
    byId('item-view-image').hidden = true;
    byId('item-view-content').textContent = content;
    byId('item-view').showModal();
  }

  function showPicture(value) {
    showItem('Picture', pictureKeyFromValue(value));
    const image = byId('item-view-image');
    image.src = value;
    image.hidden = false;
  }

  function openRecordTextEditor(name, node = null) {
    state.recordKind = name;
    state.recordEditing = node;
    byId('record-text-title').textContent = `${node ? 'Edit' : 'Add'} ${name.toLowerCase()}`;
    byId('record-text-input').value = elementEditorValue(node);
    byId('record-text-editor').showModal();
    byId('record-text-input').focus();
  }

  function deleteRecordText(name, node) {
    if (!window.confirm(`Delete this ${name.toLowerCase()}? This will be included when you save changes.`)) return;
    node.remove();
    markDirty();
    renderRecordTexts(name);
  }

  function elementEditorValue(element) {
    if (!element) return '';
    if (element.tagName !== 'Description' && element.tagName !== 'Mission') return element.textContent;
    const serializer = new XMLSerializer();
    return Array.from(element.childNodes).map((node) => {
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) return node.nodeValue;
      return serializer.serializeToString(node);
    }).join('');
  }

  function setElementEditorValue(element, value) {
    element.replaceChildren();
    if ((element.tagName === 'Description' || element.tagName === 'Mission') && /<\/?[A-Za-z][^>]*>/.test(value)) {
      const parsed = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
      const wrapper = parsed.body.firstElementChild;
      Array.from(wrapper.childNodes).forEach((node) => element.append(state.xml.importNode(node, true)));
      return;
    }
    element.textContent = value;
  }

  function renderEvents() {
    const list = byId('events-list');
    list.replaceChildren();
    const events = eventNodes();
    if (!events.length) {
      setEmptyState(list, 'No events in data.xml yet. Add an event to get started.');
      return;
    }

    events.forEach((eventNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';

      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = `${eventNode.getAttribute('name') || 'Untitled event'} - ${eventNode.getAttribute('date') || 'No date set'}`;
      copy.append(title);

      const picture = eventNode.querySelector('Picture')?.textContent.trim();
      const picturePreview = picture ? document.createElement('img') : null;
      if (picturePreview) {
        picturePreview.className = 'event-row-picture';
        picturePreview.src = picture;
        picturePreview.alt = `${eventNode.getAttribute('name') || 'Event'} picture`;
        picturePreview.loading = 'lazy';
      }

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openEventEditor(eventNode)),
        createButton('Delete', 'btn-danger', () => deleteEvent(eventNode))
      );
      row.append(copy);
      if (picturePreview) row.append(picturePreview);
      row.append(actions);
      list.append(row);
    });
  }

  function renderDuties() {
    const list = byId('duties-list');
    list.replaceChildren();
    const duties = dutyNodes();
    if (!duties.length) {
      setEmptyState(list, 'No duties in data.xml yet. Add a duty to get started.');
      return;
    }

    duties.forEach((dutyNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = dutyNode.textContent.trim().replace(/\s+/g, ' ') || 'Unnamed duty';
      copy.append(title);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openDutyEditor(dutyNode)),
        createButton('Delete', 'btn-danger', () => deleteDuty(dutyNode))
      );
      row.append(copy, actions);
      list.append(row);
    });
  }

  function renderCharities() {
    const list = byId('charities-list');
    list.replaceChildren();
    const charities = Array.from(state.xml.querySelectorAll('Charities > Charity'));
    if (!charities.length) {
      setEmptyState(list, 'No charities in data.xml yet. Add a charity to get started.');
      return;
    }

    charities.forEach((charityNode) => {
      const row = document.createElement('article');
      row.className = 'admin-row';
      const copy = document.createElement('div');
      copy.className = 'row-copy';
      const title = document.createElement('h3');
      title.textContent = charityNode.getAttribute('name') || 'Unnamed charity';
      copy.append(title);

      const actions = document.createElement('div');
      actions.className = 'row-actions';
      actions.append(
        createButton('Edit', 'btn-turquoise', () => openEventEditor(charityNode, false, 'charity')),
        createButton('Delete', 'btn-danger', () => deleteCharity(charityNode))
      );
      row.append(copy, actions);
      list.append(row);
    });
  }

  function pictureKeyFromValue(value) {
    const path = value.trim().split(/[?#]/, 1)[0];
    const basename = path.replace(/\\/g, '/').split('/').pop();
    try {
      return decodeURIComponent(basename);
    } catch {
      return basename;
    }
  }

  async function loadPictures() {
    try {
      const response = await fetch('/api/admin/pictures', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not load pictures (${response.status}).`);
      state.pictures = result.pictures || [];
      return null;
    } catch (error) {
      state.pictures = [];
      return error.message || 'Picture library unavailable.';
    }
  }

  async function convertToWebp(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not prepare the picture for upload.');

      let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt += 1) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        for (const quality of [0.9, 0.78, 0.66, 0.54, 0.42, 0.3]) {
          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('This browser could not convert the picture to WebP.')), 'image/webp', quality);
          });
          if (blob.type !== 'image/webp') throw new Error('This browser does not support WebP image conversion.');
          if (blob.size < 1024 * 1024) return blob;
        }
        scale *= 0.75;
      }
      throw new Error('Could not reduce this picture below 1 MB.');
    } finally {
      bitmap.close();
    }
  }

  async function uploadSlideshowPicture(file) {
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    const inputTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    const expectedType = Object.hasOwn(inputTypes, extension) ? inputTypes[extension] : null;
    if (!expectedType || (file.type && file.type !== expectedType)) {
      byId('slideshow-upload-status').textContent = 'Choose a JPG, JPEG, PNG, WebP, or GIF picture.';
      return;
    }

    const form = byId('slideshow-upload-form');
    const submitButton = form.querySelector('[type="submit"]');
    const uploadStatus = byId('slideshow-upload-status');
    submitButton.disabled = true;
    uploadStatus.textContent = `Converting ${file.name} to WebP...`;
    try {
      const webp = await convertToWebp(file);
      const body = new FormData();
      body.append('file', webp, 'gallery.webp');
      const response = await fetch('/api/admin/slideshow-pictures', {
        method: 'POST',
        credentials: 'same-origin',
        body
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      uploadStatus.textContent = `Uploaded ${result.picture.key} to Gallery.`;
      status(`Uploaded ${result.picture.key} to the slideshow gallery.`);
      await loadSlideshowPictures();
    } catch (error) {
      uploadStatus.textContent = error.message || 'Could not upload picture.';
    } finally {
      submitButton.disabled = false;
      byId('slideshow-picture-file').value = '';
    }
  }

  function renderSlideshowPictures(pictures) {
    const list = byId('slideshow-picture-list');
    list.replaceChildren();
    if (!pictures.length) {
      setEmptyState(list, 'No pictures in the gallery yet.');
      return;
    }

    pictures.forEach((picture) => {
      const row = document.createElement('article');
      row.className = 'gallery-picture-row';
      const image = document.createElement('img');
      image.src = `/images/slideshow/${picture.key.split('/').map(encodeURIComponent).join('/')}`;
      image.alt = picture.key;
      image.loading = 'lazy';
      const name = document.createElement('span');
      name.className = 'gallery-picture-name';
      name.textContent = picture.key;
      const deleteButton = createButton('Delete', 'btn-danger', () => deleteSlideshowPicture(picture.key, deleteButton));
      row.append(image, name, deleteButton);
      list.append(row);
    });
  }

  async function loadSlideshowPictures() {
    const list = byId('slideshow-picture-list');
    list.textContent = 'Loading pictures...';
    try {
      const response = await fetch('/api/admin/slideshow-pictures', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not load pictures (${response.status}).`);
      renderSlideshowPictures(result.pictures || []);
    } catch (error) {
      list.replaceChildren();
      setEmptyState(list, error.message || 'Could not load gallery pictures.');
    }
  }

  async function deleteSlideshowPicture(key, button) {
    if (!window.confirm(`Delete ${key} from the gallery? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      const response = await fetch(`/api/admin/slideshow-pictures?name=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not delete picture (${response.status}).`);
      status(`Deleted ${key} from the slideshow gallery.`);
      await loadSlideshowPictures();
    } catch (error) {
      status(error.message || `Could not delete ${key}.`, 'error');
      button.disabled = false;
    }
  }

  function setEventPicture(eventNode, url) {
    const pictureElements = Array.from(eventNode.children).filter((child) => child.tagName === 'Picture');
    if (pictureElements.length) pictureElements.forEach((picture) => { picture.textContent = url; });
    else {
      const picture = state.xml.createElement('Picture');
      picture.textContent = url;
      eventNode.append(picture);
    }
  }

  async function uploadPicture(file) {
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    const inputTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    const expectedType = Object.hasOwn(inputTypes, extension) ? inputTypes[extension] : null;
    if (!expectedType || (file.type && file.type !== expectedType)) {
      byId('event-editor-message').textContent = 'Choose a JPG, JPEG, PNG, WebP, or GIF image.';
      return;
    }

    const targetDraft = state.eventDraft;
    const button = byId('event-picture-upload');
    button.disabled = true;
    byId('event-form').querySelector('[type="submit"]').disabled = true;
    state.pictureUploading = true;
    status(`Converting and uploading ${file.name}...`);
    try {
      const webp = await convertToWebp(file);
      const sourceName = file.name.replace(/\\/g, '/').split('/').pop().replace(/\.[^.]*$/, '');
      const safeSourceName = sourceName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'picture';
      const key = `event-${safeSourceName}-${crypto.randomUUID()}.webp`;
      const form = new FormData();
      form.append('file', webp, key);
      const response = await fetch('/api/admin/pictures', {
        method: 'POST',
        credentials: 'same-origin',
        body: form
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      const newPictureKey = result.picture?.key || key;
      state.pictures.push(result.picture || { key: newPictureKey });
      if (state.eventDraft !== targetDraft || !byId('event-editor').open) {
        await deleteStoredPicture(newPictureKey);
        state.pictures = state.pictures.filter((picture) => picture.key !== newPictureKey);
        status('Canceled upload removed from eventpictures.');
        return;
      }
      const previousUpload = state.pendingEventPicture;
      state.pendingEventPicture = newPictureKey;
      setEventPicture(state.eventDraft, `/r2-images/${encodeURIComponent(newPictureKey)}`);
      renderEventFields();
      if (previousUpload) {
        await deleteStoredPicture(previousUpload);
        state.pictures = state.pictures.filter((picture) => picture.key !== previousUpload);
      }
      status(`${newPictureKey} is ready. Apply event changes, then Save changes to update data.xml.`, 'dirty');
    } catch (error) {
      status(error.message || 'Could not upload picture.', 'error');
      if (byId('event-editor').open) byId('event-editor-message').textContent = error.message || 'Could not upload picture.';
    } finally {
      state.pictureUploading = false;
      const currentButton = byId('event-picture-upload');
      if (currentButton) currentButton.disabled = false;
      if (state.eventDraft === targetDraft && byId('event-editor').open) {
        byId('event-form').querySelector('[type="submit"]').disabled = false;
      }
      byId('picture-file').value = '';
    }
  }

  async function deleteStoredPicture(key) {
    const response = await fetch(`/api/admin/pictures?name=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Could not delete ${key} (${response.status}).`);
      error.status = response.status;
      throw error;
    }
  }

  function eventFieldNames(kind) {
    const nodes = state.eventKind === 'event' ? eventNodes() : [state.eventDraft];
    const defaults = kind === 'attribute'
      ? state.eventKind === 'event' ? ['name', 'date', 'fee', 'time'] : ['name']
      : state.eventKind === 'event' ? ['Location', 'Description', 'Included', 'Charity'] : ['Description', 'Website', 'PayLink'];
    const names = new Set(state.eventIsNew ? defaults : kind === 'attribute'
      ? state.eventKind === 'event' ? ['name', 'date', 'fee'] : ['name']
      : []);
    for (const node of [...nodes, state.eventDraft]) {
      const fields = kind === 'attribute' ? Array.from(node.attributes) : Array.from(node.children);
      fields.forEach((field) => names.add(kind === 'attribute' ? field.name : field.tagName));
    }
    if (kind === 'element' && state.eventKind === 'event') {
      names.delete('Picture');
      names.delete('Duty');
    }
    return names;
  }

  function linkExampleUrl(name, value) {
    if (state.eventKind !== 'charity' || !['Website', 'PayLink'].includes(name)) return value;
    const parsed = new DOMParser().parseFromString(value, 'text/html');
    const link = parsed.body.firstElementChild;
    return link?.tagName === 'A' && parsed.body.children.length === 1
      ? link.getAttribute('href') || value
      : value;
  }

  function populateCharityOptions(select, selectedValue = '') {
    select.replaceChildren();
    const noCharity = document.createElement('option');
    noCharity.value = '';
    noCharity.textContent = 'No charity';
    select.append(noCharity);
    const names = Array.from(state.xml.querySelectorAll('Charities > Charity'))
      .map((charity) => charity.getAttribute('name')?.trim())
      .filter(Boolean);
    if (selectedValue && !names.includes(selectedValue)) names.unshift(selectedValue);
    [...new Set(names)].forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.append(option);
    });
    select.value = selectedValue;
  }

  function renderFieldGroup(container, kind, name) {
    const group = document.createElement('section');
    group.className = 'event-field-group';
    if (state.eventIsNew) {
      group.classList.add('event-add-field-group');
      const label = document.createElement('label');
      const fieldId = `event-add-${kind}-${name}`;
      label.htmlFor = fieldId;
      label.textContent = name;
      const isEventCharity = kind === 'element' && state.eventKind === 'event' && name === 'Charity';
      const field = kind === 'attribute'
        ? document.createElement('input')
        : isEventCharity ? document.createElement('select') : document.createElement('textarea');
      field.id = fieldId;
      field.className = 'event-add-field';
      field.dataset.addFieldKind = kind;
      field.dataset.addFieldName = name;
      if (kind === 'attribute') {
        field.type = 'text';
        field.required = name === 'name' || (state.eventKind === 'event' && name === 'date');
      } else if (isEventCharity) {
        populateCharityOptions(field);
      } else {
        field.rows = 3;
        if (state.eventKind === 'charity') {
          const examples = {
            Website: '<a href="https://example.com">Website</a>',
            PayLink: '<a href="https://example.com">Donate</a>'
          };
          field.value = examples[name] || '';
        }
      }
      group.append(label, field);
      container.append(group);
      return;
    }

    const elements = kind === 'element'
      ? Array.from(state.eventDraft.children).filter((child) => child.tagName === name)
      : [null];

    elements.forEach((element, index) => {
      const value = kind === 'attribute' ? state.eventDraft.getAttribute(name) : elementEditorValue(element);
      const row = document.createElement('div');
      row.className = 'event-field-row';
      const label = document.createElement('label');
      const field = document.createElement('input');
      field.type = 'text';
      field.className = 'event-field-input';
      field.id = `event-field-${kind}-${name}-${index}`;
      field.value = value || '';
      label.htmlFor = field.id;
      label.textContent = name;
      field.addEventListener('input', () => {
        if (kind === 'attribute') {
          if (field.value || state.eventDraft.hasAttribute(name)) state.eventDraft.setAttribute(name, field.value);
        } else {
          setElementEditorValue(element, field.value);
        }
      });
      row.append(label, field);
      if (kind === 'element') {
        row.append(createButton('Remove', 'btn-danger', () => {
          element.remove();
          renderEventFields();
        }));
      }
      group.append(row);
    });
    container.append(group);
  }

  function renderEventFields() {
    const attributes = byId('event-attributes');
    attributes.replaceChildren();
    const attributeHeading = document.createElement('div');
    attributeHeading.className = 'field-list-heading';
    const attributeTitle = document.createElement('h3');
    attributeTitle.textContent = 'Attributes';
    attributeHeading.append(attributeTitle);
    attributes.append(attributeHeading);
    eventFieldNames('attribute').forEach((name) => renderFieldGroup(attributes, 'attribute', name));

    const elements = byId('event-elements');
    elements.replaceChildren();
    if (state.eventKind === 'event') {
      const dutyGroup = document.createElement('section');
      dutyGroup.className = 'event-duty-group';
      const dutyHeading = document.createElement('h3');
      dutyHeading.textContent = 'Duties';
      dutyGroup.append(dutyHeading);

      const assignedDuties = Array.from(state.eventDraft.children)
        .filter((child) => child.tagName === 'Duty');
      assignedDuties.forEach((duty) => {
        const row = document.createElement('div');
        row.className = 'event-field-row';
        const label = document.createElement('label');
        label.textContent = 'Duty';
        const value = document.createElement('span');
        value.className = 'event-duty-name';
        value.textContent = duty.textContent.trim();
        row.append(label, value, createButton('Remove', 'btn-danger', () => {
          duty.remove();
          renderEventFields();
        }));
        dutyGroup.append(row);
      });

      const dutyControl = document.createElement('div');
      dutyControl.className = 'event-duty-control';
      const dutyInput = document.createElement('input');
      dutyInput.type = 'text';
      dutyInput.className = 'event-field-input';
      dutyInput.placeholder = 'Enter an event-specific duty';
      dutyInput.setAttribute('aria-label', 'New event duty');
      const addDuty = createButton('Add duty', 'btn-turquoise', () => {
        const value = dutyInput.value.trim();
        if (!value) return;
        if (assignedDuties.some((duty) => duty.textContent.trim() === value)) {
          dutyInput.setCustomValidity('This duty is already assigned to the event.');
          dutyInput.reportValidity();
          return;
        }
        const duty = state.xml.createElement('Duty');
        duty.textContent = value;
        state.eventDraft.append(duty);
        renderEventFields();
      });
      addDuty.disabled = true;
      dutyInput.addEventListener('input', () => {
        dutyInput.setCustomValidity('');
        addDuty.disabled = !dutyInput.value.trim();
      });
      dutyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addDuty.click();
        }
      });
      dutyControl.append(dutyInput, addDuty);
      dutyGroup.append(dutyControl);
      elements.append(dutyGroup);
    }

    eventFieldNames('element').forEach((name) => renderFieldGroup(elements, 'element', name));

    const pictureContainer = byId('event-picture');
    pictureContainer.replaceChildren();
    if (state.eventKind !== 'event') return;
    const picture = state.eventDraft.querySelector('Picture');
    const row = document.createElement('div');
    row.className = 'event-field-row';
    const label = document.createElement('label');
    label.htmlFor = 'event-picture-url';
    label.textContent = 'Picture';
    const field = document.createElement('input');
    field.type = 'text';
    field.id = 'event-picture-url';
    field.className = 'event-field-input';
    field.value = picture?.textContent.trim() || '';
    field.addEventListener('input', () => setEventPicture(state.eventDraft, field.value));
    row.append(label, field);
    pictureContainer.append(row);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const upload = createButton('Upload picture', 'btn-turquoise', () => byId('picture-file').click());
    upload.id = 'event-picture-upload';
    upload.disabled = state.pictureUploading;
    actions.append(upload);
    if (picture) {
      actions.append(createButton('Remove', 'btn-danger', async () => {
        if (state.pendingEventPicture) {
          try {
            await deleteStoredPicture(state.pendingEventPicture);
            state.pictures = state.pictures.filter((stored) => stored.key !== state.pendingEventPicture);
            state.pendingEventPicture = null;
          } catch (error) {
            status(error.message, 'error');
            return;
          }
        }
        Array.from(state.eventDraft.children).filter((child) => child.tagName === 'Picture').forEach((child) => child.remove());
        renderEventFields();
      }));
    }
    pictureContainer.append(actions);
  }

  function openEventEditor(eventNode, isNew = false, kind = 'event') {
    state.eventEditing = eventNode;
    state.eventDraft = eventNode.cloneNode(true);
    state.eventIsNew = isNew;
    state.eventKind = kind;
    state.pendingEventPicture = null;
    byId('event-editor-message').textContent = '';
    const label = kind === 'charity' ? 'charity' : 'event';
    byId('event-editor-title').textContent = isNew ? `Add ${label}` : `Edit ${eventNode.getAttribute('name') || label}`;
    const apply = byId('event-form').querySelector('[type="submit"]');
    apply.textContent = `Apply ${label} changes`;
    apply.disabled = state.pictureUploading;
    renderEventFields();
    byId('event-editor').showModal();
  }

  function getContainer(name) {
    let container = state.xml.querySelector(`Record > ${name}`);
    if (!container) {
      container = state.xml.createElement(name);
      state.xml.documentElement.append(container);
    }
    return container;
  }

  function deleteEvent(eventNode) {
    const label = eventNode.getAttribute('name') || 'this event';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    eventNode.remove();
    markDirty();
    renderEvents();
  }

  function deleteCharity(charityNode) {
    const label = charityNode.getAttribute('name') || 'this charity';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    charityNode.remove();
    markDirty();
    renderCharities();
  }

  function openDutyEditor(dutyNode, isNew = false) {
    state.dutyEditing = dutyNode;
    state.dutyIsNew = isNew;
    byId('duty-editor-title').textContent = isNew ? 'Add duty' : 'Edit duty';
    byId('duty-name').value = isNew ? '' : dutyNode.textContent.trim();
    byId('duty-editor').showModal();
    byId('duty-name').focus();
  }

  function deleteDuty(dutyNode) {
    const label = dutyNode.textContent.trim() || 'this duty';
    if (!window.confirm(`Delete ${label}? This will be included when you save changes.`)) return;
    dutyNode.remove();
    markDirty();
    renderDuties();
  }

  function indentXmlElement(element, depth, document) {
    if (element.tagName === 'Description' || element.tagName === 'Mission') return;

    const children = Array.from(element.childNodes);
    const hasTextContent = children.some((child) =>
      (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) || child.nodeType === Node.CDATA_SECTION_NODE);
    if (hasTextContent) return;

    const indentable = children.filter((child) =>
      child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.COMMENT_NODE);
    if (!indentable.length) return;

    indentable.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) indentXmlElement(child, depth + 1, document);
    });
    children.filter((child) => child.nodeType === Node.TEXT_NODE && !child.nodeValue.trim())
      .forEach((child) => child.remove());
    indentable.forEach((child) => {
      element.insertBefore(document.createTextNode(`\n${'  '.repeat(depth + 1)}`), child);
    });
    element.append(document.createTextNode(`\n${'  '.repeat(depth)}`));
  }

  function serializeIndentedXml(xml) {
    const formatted = xml.cloneNode(true);
    indentXmlElement(formatted.documentElement, 0, formatted);
    return new XMLSerializer().serializeToString(formatted);
  }

  async function saveData() {
    if (!state.dirty && !state.pendingPictureDeletions.size) return;
    const button = byId('save-data');
    button.disabled = true;
    status('Saving data.xml...');
    try {
      if (state.dirty) {
        const xmlText = serializeIndentedXml(state.xml);
        const response = await fetch('/api/admin/data', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          body: xmlText
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Save failed (${response.status}).`);
        state.dirty = false;
      }

      const failures = [];
      const shared = [];
      for (const key of state.pendingPictureDeletions) {
        try {
          await deleteStoredPicture(key);
          state.pendingPictureDeletions.delete(key);
        } catch (error) {
          if (error.status === 409 || error.status === 404) {
            state.pendingPictureDeletions.delete(key);
            if (error.status === 409) shared.push(key);
          } else failures.push(error.message);
        }
      }
      await loadPictures();
      status(failures.length ? `data.xml saved, but old picture cleanup failed: ${failures.join(' ')}`
        : shared.length ? `Changes saved. ${shared.join(', ')} remains stored because another event still uses it.` : 'Changes Saved',
        failures.length ? 'error' : 'info');
    } catch (error) {
      status(error.message || 'Could not save data.xml.', 'error');
    } finally {
      button.disabled = !state.dirty && !state.pendingPictureDeletions.size;
    }
  }

  byId('reload-data').addEventListener('click', () => loadData());
  byId('save-data').addEventListener('click', saveData);
  byId('gallery-upload-open').addEventListener('click', () => {
    byId('slideshow-upload-form').reset();
    byId('slideshow-upload-status').textContent = '';
    byId('slideshow-upload-dialog').showModal();
    loadSlideshowPictures();
  });
  byId('slideshow-upload-form').addEventListener('submit', (event) => {
    event.preventDefault();
    uploadSlideshowPicture(byId('slideshow-picture-file').files[0]);
  });
  byId('add-event').addEventListener('click', () => {
    const eventNode = state.xml.createElement('Event');
    openEventEditor(eventNode, true);
  });
  byId('add-charity').addEventListener('click', () => {
    const charityNode = state.xml.createElement('Charity');
    charityNode.setAttribute('name', '');
    ['Description', 'Website', 'PayLink'].forEach((name) => charityNode.append(state.xml.createElement(name)));
    openEventEditor(charityNode, true, 'charity');
  });
  byId('add-duty').addEventListener('click', () => {
    const dutyNode = state.xml.createElement('Duty');
    openDutyEditor(dutyNode, true);
  });
  byId('picture-file').addEventListener('change', (event) => uploadPicture(event.target.files[0]));

  byId('event-editor').addEventListener('close', async () => {
    if (!state.pendingEventPicture) return;
    const key = state.pendingEventPicture;
    state.pendingEventPicture = null;
    try {
      await deleteStoredPicture(key);
      state.pictures = state.pictures.filter((picture) => picture.key !== key);
      status('Canceled upload removed from eventpictures.');
    } catch (error) {
      status(`The unused upload ${key} could not be removed: ${error.message}`, 'error');
    }
  });

  byId('add-description').addEventListener('click', () => openRecordTextEditor('Description'));
  byId('add-mission').addEventListener('click', () => openRecordTextEditor('Mission'));
  byId('record-text-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = state.recordKind;
    const value = byId('record-text-input').value;
    if (!value.trim()) return;
    const node = state.recordEditing || state.xml.createElement(name);
    setElementEditorValue(node, value);
    if (!state.recordEditing) {
      const lastOfKind = recordTextNodes(name).at(-1);
      if (lastOfKind) lastOfKind.after(node);
      else if (name === 'Mission' && recordTextNodes('Description').length) recordTextNodes('Description').at(-1).after(node);
      else state.xml.documentElement.prepend(node);
    }
    byId('record-text-editor').close();
    state.recordEditing = null;
    state.recordKind = null;
    markDirty();
    renderRecordTexts(name);
  });

  byId('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const node = state.eventDraft;
    if (state.eventIsNew) {
      byId('event-editor').querySelectorAll('[data-add-field-kind="attribute"]').forEach((field) => {
        const name = field.dataset.addFieldName;
        if (field.value.trim() || name === 'name' || (state.eventKind === 'event' && name === 'date')) {
          node.setAttribute(name, field.value);
        } else {
          node.removeAttribute(name);
        }
      });
      Array.from(node.children).filter((child) => child.tagName !== 'Picture' && child.tagName !== 'Duty').forEach((child) => child.remove());
      byId('event-editor').querySelectorAll('[data-add-field-kind="element"]').forEach((field) => {
        const value = linkExampleUrl(field.dataset.addFieldName, field.value);
        if (!value.trim()) return;
        const child = state.xml.createElement(field.dataset.addFieldName);
        setElementEditorValue(child, value);
        node.append(child);
      });
    }
    if (!node.getAttribute('name')?.trim() || (state.eventKind === 'event' && !node.getAttribute('date')?.trim())) {
      byId('event-editor-message').textContent = state.eventKind === 'event' ? 'Event name and date are required.' : 'Charity name is required.';
      return;
    }
    const oldPicture = state.eventEditing.querySelector('Picture')?.textContent || '';
    const newPicture = node.querySelector('Picture')?.textContent || '';
    const oldKey = oldPicture ? pictureKeyFromValue(oldPicture) : '';
    if (state.eventKind === 'event' && oldPicture !== newPicture && state.pictures.some((picture) => picture.key === oldKey)) {
      state.pendingPictureDeletions.add(oldKey);
    }
    if (state.eventIsNew) getContainer(state.eventKind === 'charity' ? 'Charities' : 'Events').append(node);
    else state.eventEditing.replaceWith(node);
    state.pendingEventPicture = null;
    byId('event-editor').close();
    state.eventEditing = null;
    state.eventDraft = null;
    state.eventIsNew = false;
    markDirty();
    if (state.eventKind === 'charity') renderCharities();
    else renderEvents();
  });

  byId('duty-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = byId('duty-name').value.trim();
    if (!value) return;
    if (state.dutyIsNew) {
      state.dutyEditing.textContent = value;
      getContainer('Duties').append(state.dutyEditing);
    } else {
      state.dutyEditing.textContent = value;
    }
    byId('duty-editor').close();
    state.dutyEditing = null;
    state.dutyIsNew = false;
    markDirty();
    renderDuties();
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => byId(button.dataset.closeDialog).close());
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty && !state.pendingEventPicture) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadData();
})();
