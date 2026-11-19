(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const contentUrl = '/blog-content.json';
  const draftKey = 'chen-journal-draft-v1';
  const maxPhotos = 8;
  const maxPhotoLength = 480000;
  const photoIdPattern = /^[a-f0-9]{12}$/;
  const avatarPattern = /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/=]+$/i;
  const slugPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
  const legacy = [
    { title: 'my-test-draft', slug: 'legacy-my-test-draft', date: '2024-05-10T02:07:40Z', cover: '/images/blog-draft.webp', summary: '', body: '' },
    { title: 'mt-tset-post', slug: 'legacy-mt-tset-post', date: '2024-05-10T02:06:08Z', cover: '/images/blog-test.webp', summary: '', body: '' },
    { title: 'Hello World', slug: 'legacy-hello-world', date: '2024-05-10T01:54:31Z', cover: '/images/blog-hello.webp', summary: 'Hexo 入门示例，包含写作、预览和部署命令。', body: 'Welcome to [Hexo](https://hexo.io/)! This is your very first post. Check [documentation](https://hexo.io/docs/) for more info. If you get any problems when using Hexo, you can find the answer in [troubleshooting](https://hexo.io/docs/troubleshooting.html) or you can ask me on [GitHub](https://github.com/hexojs/hexo/issues).\n\n## Quick Start\n\n### Create a new post\n\n```bash\n$ hexo new "My New Post"\n```\n\nMore info: [Writing](https://hexo.io/docs/writing.html)\n\n### Run server\n\n```bash\n$ hexo server\n```\n\nMore info: [Server](https://hexo.io/docs/server.html)\n\n### Generate static files\n\n```bash\n$ hexo generate\n```\n\nMore info: [Generating](https://hexo.io/docs/generating.html)\n\n### Deploy to remote sites\n\n```bash\n$ hexo deploy\n```\n\nMore info: [Deployment](https://hexo.io/docs/one-command-deployment.html)' },
  ].map((post) => ({ ...post, url: '/2024/05/10/' + post.slug.slice(7) + '/' }));
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long', timeZone: 'Asia/Shanghai',
  });

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function initTheme() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;
    const preference = matchMedia('(prefers-color-scheme: dark)');
    let saved;
    try { saved = localStorage.getItem('chen-journal-theme'); } catch { /* Storage is optional. */ }
    if (saved !== 'light' && saved !== 'dark') saved = null;
    const apply = () => {
      const dark = saved ? saved === 'dark' : preference.matches;
      if (saved) document.documentElement.dataset.theme = saved;
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.title = dark ? '切换浅色模式' : '切换深色模式';
    };
    toggle.addEventListener('click', () => {
      saved = toggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
      try { localStorage.setItem('chen-journal-theme', saved); } catch { /* The current page still switches. */ }
      apply();
    });
    preference.addEventListener('change', apply);
    apply();
    toggle.hidden = false;
  }

  function parseTags(input) {
    const tags = new Map();
    for (const value of input.split(/[,，、]/)) {
      const tag = value.trim();
      if (tag && !tags.has(tag.toLocaleLowerCase())) tags.set(tag.toLocaleLowerCase(), tag);
    }
    return [...tags.values()];
  }

  function validTags(tags) {
    return tags === undefined || (Array.isArray(tags) && tags.length <= 6
      && tags.every((tag) => typeof tag === 'string' && tag === tag.trim() && tag.length > 0 && tag.length <= 24));
  }

  function validAvatar(src) {
    return typeof src === 'string' && src.length < 180000 && avatarPattern.test(src);
  }

  function validPhotos(photos) {
    return photos === undefined || (Array.isArray(photos) && photos.length <= maxPhotos
      && new Set(photos.map((photo) => photo?.id)).size === photos.length
      && photos.every((photo) => photo && typeof photo.id === 'string' && photoIdPattern.test(photo.id)
        && typeof photo.src === 'string' && photo.src.length <= maxPhotoLength && avatarPattern.test(photo.src)));
  }

  function allPosts(data) {
    const items = new Map(data.posts.map((post) => [post.slug, post]));
    for (const post of legacy) {
      const override = items.get(post.slug);
      items.set(post.slug, override ? { ...override, url: post.url, cover: post.cover } : post);
    }
    return [...items.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }

  function displayAvatar(src) {
    document.querySelectorAll('[data-avatar]').forEach((image) => {
      image.src = validAvatar(src) ? src : '/images/avatar.jpg';
    });
  }

  async function loadContent() {
    const response = await fetch(contentUrl, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('无法读取已发布内容。');
    const data = await response.json();
    if (!data || !Array.isArray(data.posts) || (data.avatar !== null && !validAvatar(data.avatar))) {
      throw new Error('发布数据格式有误。');
    }
    const ids = new Set();
    for (const post of data.posts) {
      if (!post || typeof post.slug !== 'string' || !slugPattern.test(post.slug) || ids.has(post.slug)
          || typeof post.title !== 'string' || typeof post.summary !== 'string'
          || typeof post.body !== 'string' || typeof post.date !== 'string'
          || !Number.isFinite(Date.parse(post.date)) || !validPhotos(post.photos) || !validTags(post.tags)) {
        throw new Error('有文章的格式有误。');
      }
      ids.add(post.slug);
    }
    return data;
  }

  function appendInline(parent, input) {
    const syntax = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s()]+)\)/g;
    let end = 0;
    for (const match of input.matchAll(syntax)) {
      parent.append(input.slice(end, match.index));
      if (match[1]) parent.append(element('code', match[1]));
      else if (match[2]) parent.append(element('strong', match[2]));
      else {
        const link = element('a', match[3]);
        link.href = match[4];
        link.rel = 'noopener noreferrer';
        parent.append(link);
      }
      end = match.index + match[0].length;
    }
    parent.append(input.slice(end));
  }

  function renderMarkdown(container, markdown, photos = []) {
    container.replaceChildren();
    const photosById = new Map(photos.map((photo) => [photo.id, photo.src]));
    let paragraph = [];
    let list = null;
    let code = null;

    const flushParagraph = () => {
      if (paragraph.length) {
        const block = element('p');
        appendInline(block, paragraph.join(' '));
        container.append(block);
        paragraph = [];
      }
    };
    const flushCode = () => {
      const block = element('pre');
      block.append(element('code', code.join('\n')));
      container.append(block);
      code = null;
    };

    for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
      if (/^\s*```/.test(line)) {
        flushParagraph();
        list = null;
        if (code) flushCode();
        else code = [];
        continue;
      }
      if (code) {
        code.push(line);
        continue;
      }
      const photo = /^!\[([^\]\n]*)\]\(photo:([a-f0-9]{12})\)$/.exec(line.trim());
      if (photo && photosById.has(photo[2])) {
        flushParagraph();
        list = null;
        const figure = element('figure');
        const image = element('img');
        image.src = photosById.get(photo[2]);
        image.alt = photo[1];
        image.loading = 'lazy';
        image.decoding = 'async';
        figure.append(image);
        container.append(figure);
        continue;
      }
      const heading = /^(#{1,5})\s+(.+)$/.exec(line);
      const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
      if (bullet) {
        flushParagraph();
        if (!list) {
          list = element('ul');
          container.append(list);
        }
        const item = element('li');
        appendInline(item, bullet[1]);
        list.append(item);
        continue;
      }
      list = null;
      if (heading || !line.trim()) {
        flushParagraph();
        if (heading) {
          const block = element('h' + (heading[1].length + 1));
          appendInline(block, heading[2]);
          container.append(block);
        }
      } else paragraph.push(line.trim());
    }
    flushParagraph();
    if (code) flushCode();
  }

  function timeLabel(date) {
    const time = element('time', dateFormat.format(new Date(date)));
    time.dateTime = date;
    return time;
  }

  function renderTags(container, tags = [], linkToFilter = false) {
    container.replaceChildren();
    for (const tag of tags) {
      const item = element(linkToFilter ? 'a' : 'span', tag, 'tag');
      if (linkToFilter) item.href = '/?tag=' + encodeURIComponent(tag) + '#posts';
      container.append(item);
    }
    container.hidden = !tags.length;
  }

  function renderCard(post) {
    const card = element('article', undefined, 'card');
    const link = element('a');
    link.href = post.url || '/article.html?p=' + encodeURIComponent(post.slug);
    const body = element('div', undefined, 'card-body');
    const arrow = element('span', '↗', 'card-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    body.append(timeLabel(post.date), element('h3', post.title), arrow);
    if (post.summary) body.append(element('p', post.summary));
    if (post.tags?.length) {
      const tags = element('div', undefined, 'tag-list');
      renderTags(tags, post.tags);
      body.append(tags);
    }
    if (post.cover) {
      const image = element('img');
      image.src = post.cover;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      link.append(image);
    }
    link.append(body);
    card.append(link);
    return card;
  }

  async function initHome() {
    const grid = byId('post-grid');
    const search = byId('search');
    const order = byId('post-order');
    const filter = byId('post-tags');
    let posts = legacy;
    let currentTag = new URLSearchParams(location.search).get('tag')?.toLocaleLowerCase() || '';

    const update = () => {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches = posts.filter((post) => {
        const tags = (post.tags || []).map((tag) => tag.toLocaleLowerCase());
        const text = [post.title, post.summary, post.body, ...tags].join(' ').toLocaleLowerCase();
        return (!currentTag || tags.includes(currentTag)) && terms.every((term) => text.includes(term));
      });
      if (order.value === 'oldest') matches.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      byId('result-count').textContent = matches.length + ' 篇文章';
      grid.replaceChildren(...matches.map(renderCard));
      if (!matches.length) grid.append(element('p', '没有找到匹配的文章。', 'muted'));
      for (const button of filter.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.tag === currentTag));
      }
    };

    search.addEventListener('input', update);
    order.addEventListener('change', update);
    byId('order-control').hidden = false;
    try {
      const data = await loadContent();
      displayAvatar(data.avatar);
      posts = allPosts(data);
    } catch {
      byId('feed-status').textContent = '暂时无法刷新新文章，已显示归档中的文章。';
    }
    const tags = new Map();
    for (const post of posts) {
      for (const tag of post.tags || []) tags.set(tag.toLocaleLowerCase(), tag);
    }
    if (currentTag && !tags.has(currentTag)) currentTag = '';
    if (tags.size) {
      filter.hidden = false;
      for (const [key, label] of [['', '全部标签'], ...tags]) {
        const button = element('button', label, 'tag');
        button.type = 'button';
        button.dataset.tag = key;
        button.addEventListener('click', () => {
          currentTag = key;
          const url = new URL(location.href);
          if (key) url.searchParams.set('tag', label);
          else url.searchParams.delete('tag');
          history.replaceState(null, '', url);
          update();
        });
        filter.append(button);
      }
    }
    update();
  }

  function initReading(body) {
    const progress = byId('reading-progress');
    const toc = byId('article-toc');
    const tocLinks = byId('toc-links');
    const dialog = byId('photo-dialog');
    const zoomedPhoto = byId('zoomed-photo');
    const headings = [...body.querySelectorAll('h2,h3,h4,h5,h6')];
    const ids = new Set();
    for (const heading of headings) {
      const stem = heading.textContent.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
      let id = stem;
      for (let duplicate = 2; ids.has(id) || document.getElementById(id); duplicate++) id = stem + '-' + duplicate;
      heading.id = id;
      ids.add(id);
      const link = element('a', heading.textContent);
      link.href = '#' + encodeURIComponent(id);
      link.dataset.level = heading.tagName.slice(1);
      tocLinks.append(link);
    }
    toc.hidden = !headings.length;
    if (location.hash) {
      try {
        const anchor = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (anchor && body.contains(anchor)) anchor.scrollIntoView({ behavior: 'instant' });
      } catch { /* Ignore a malformed fragment. */ }
    }

    let framePending = false;
    const updateProgress = () => {
      const rect = body.getBoundingClientRect();
      const range = rect.height - window.innerHeight + Math.max(0, rect.top + window.scrollY);
      progress.hidden = range <= 0;
      progress.value = range > 0 ? Math.max(0, Math.min(100, 100 * window.scrollY / range)) : 0;
      framePending = false;
    };
    const schedule = () => {
      if (!framePending) {
        framePending = true;
        requestAnimationFrame(updateProgress);
      }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(body);
    window.addEventListener('resize', schedule);
    schedule();

    byId('close-photo').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => zoomedPhoto.removeAttribute('src'));
    for (const photo of body.querySelectorAll('figure img')) {
      const trigger = element('button', undefined, 'photo-zoom');
      trigger.type = 'button';
      trigger.setAttribute('aria-label', photo.alt ? '放大照片：' + photo.alt : '放大照片');
      photo.replaceWith(trigger);
      trigger.append(photo);
      trigger.addEventListener('click', () => {
        zoomedPhoto.src = photo.currentSrc || photo.src;
        zoomedPhoto.alt = photo.alt;
        dialog.showModal();
      });
    }
  }

  async function initArticle() {
    const status = byId('article-status');
    try {
      const data = await loadContent();
      const id = new URLSearchParams(location.search).get('p');
      const post = data.posts.find((item) => item.slug === id);
      if (!post) {
        status.textContent = '这篇文章不存在或尚未发布。';
        return;
      }
      document.title = post.title + ' · Chen’s Journal';
      byId('article-title').textContent = post.title;
      byId('article-date').replaceWith(timeLabel(post.date));
      byId('article-summary').textContent = post.summary;
      byId('article-summary').hidden = !post.summary;
      displayAvatar(data.avatar);
      const body = byId('article-body');
      renderMarkdown(body, post.body, post.photos);
      renderTags(byId('article-tags'), post.tags, true);
      byId('article').hidden = false;
      status.hidden = true;
      initReading(body);
    } catch {
      status.textContent = '暂时无法读取文章，请刷新后重试。';
    }
  }

  async function prepareImage(file, crop = false) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    }
    if (file.size > 12 * 1024 * 1024) throw new Error('请选择小于 12 MB 的图片。');
    const image = await createImageBitmap(file);
    try {
      const canvas = element('canvas');
      const context = canvas.getContext('2d');
      const cropSize = Math.min(image.width, image.height);
      const width = crop ? cropSize : image.width;
      const height = crop ? cropSize : image.height;
      const x = (image.width - width) / 2;
      const y = (image.height - height) / 2;
      const limit = crop ? 384 : 1280;
      for (const scale of [1, .8, .6, .45]) {
        const ratio = Math.min(1, (limit * scale) / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
        const output = canvas.toDataURL('image/webp', .78);
        if (crop ? validAvatar(output) : output.length <= maxPhotoLength && avatarPattern.test(output)) return output;
      }
      throw new Error('图片压缩后仍然过大，请换一张较小的图片。');
    } finally {
      image.close();
    }
  }

  function initStudio() {
    const postForm = byId('post-form');
    const avatarForm = byId('avatar-form');
    const status = byId('studio-status');
    const pending = byId('pending-list');
    const prepare = byId('prepare');
    const avatarInput = avatarForm.elements.avatar;
    const avatarSubmit = avatarForm.querySelector('[type="submit"]');
    const postSubmit = postForm.querySelector('[type="submit"]');
    const editor = byId('edit-post');
    const photoInput = byId('post-photo');
    const textArea = postForm.elements.body;
    const postFields = ['title', 'summary', 'body', 'tags'];
    const staged = new Map();
    const drafts = new Map();
    let activeSlug = '';
    let photos = [];
    let editRevision = 0;
    let preparing = false;
    let insertingPhoto = false;
    let base;
    let avatar;
    let candidate;
    let selection = 0;

    const report = (message, isError = false) => {
      status.textContent = message;
      status.classList.toggle('error', isError);
    };

    const invalidateOutput = () => {
      byId('publish-steps').hidden = true;
      byId('publish-output').value = '';
    };

    const update = () => {
      pending.replaceChildren();
      for (const { post, editing } of staged.values()) {
        const row = element('li', (editing ? '更新：' : '新文章：') + post.title + ' ');
        const remove = element('button', '撤销', 'button small');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          staged.delete(post.slug);
          invalidateOutput();
          update();
        });
        row.append(remove);
        pending.append(row);
      }
      if (avatar) {
        const row = element('li', '更换头像 ');
        const remove = element('button', '撤销', 'button small');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          avatar = undefined;
          displayAvatar(candidate || base.avatar);
          invalidateOutput();
          update();
        });
        row.append(remove);
        pending.append(row);
      }
      prepare.disabled = preparing || !base || (!staged.size && !avatar);
      postSubmit.disabled = !base || insertingPhoto;
      postSubmit.textContent = activeSlug ? '保存修改到待发布' : '加入待发布';
      editor.disabled = !base;
      textArea.required = !activeSlug;
      avatarSubmit.disabled = !base || !candidate;
    };

    const readPost = () => Object.fromEntries(postFields.map((name) => [name, postForm.elements[name].value.trim()]));
    const draftStorageKey = () => activeSlug ? draftKey + ':' + activeSlug : draftKey;
    const selectedPost = () => allPosts(base).find((post) => post.slug === activeSlug);
    const saveDraft = () => {
      const selected = base && selectedPost();
      const draft = { ...readPost(), photos, sourceVersion: selected?.updatedAt || selected?.date };
      drafts.set(activeSlug, draft);
      try { localStorage.setItem(draftStorageKey(), JSON.stringify(draft)); } catch { /* Keep the current session copy. */ }
    };
    const openDraft = () => {
      ++editRevision;
      const selected = selectedPost();
      let draft = drafts.get(activeSlug);
      if (!draft) {
        try { draft = JSON.parse(localStorage.getItem(draftStorageKey()) || 'null'); } catch { /* Storage is optional. */ }
      }
      if (activeSlug && draft?.sourceVersion !== (selected?.updatedAt || selected?.date)) draft = null;
      const value = draft || staged.get(activeSlug)?.post || selected || {};
      for (const name of postFields) {
        const field = value[name];
        postForm.elements[name].value = name === 'tags' && Array.isArray(field) ? field.join('，')
          : typeof field === 'string' ? field : '';
      }
      photos = validPhotos(value.photos) ? value.photos || [] : [];
      byId('post-preview').hidden = true;
      photoInput.value = '';
      byId('image-alt').value = '';
      update();
    };

    editor.addEventListener('change', () => {
      if (!base) return;
      saveDraft();
      activeSlug = editor.value;
      openDraft();
    });
    postForm.addEventListener('input', (event) => {
      if (postFields.includes(event.target.name)) saveDraft();
    });

    const usedPhotos = (body) => photos.filter(({ id }) => body.includes('(photo:' + id + ')'));

    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      if (usedPhotos(textArea.value).length >= maxPhotos) {
        photoInput.value = '';
        report('这篇文章已达到 8 张照片。删除正文中的图片标记后可以添加。', true);
        return;
      }
      const revision = editRevision;
      const alt = byId('image-alt').value.trim().replace(/[\[\]\r\n]/g, ' ');
      photoInput.disabled = true;
      insertingPhoto = true;
      update();
      try {
        const src = await prepareImage(file);
        if (editRevision !== revision) return;
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const insertion = '\n\n![' + alt + '](photo:' + id + ')\n\n';
        const position = textArea.selectionEnd;
        if (textArea.value.length + insertion.length > textArea.maxLength) throw new Error('正文已达到长度上限，请先缩短正文。');
        photos = [...usedPhotos(textArea.value), { id, src }];
        textArea.setRangeText(insertion, position, position, 'end');
        byId('image-alt').value = '';
        byId('post-preview').hidden = true;
        saveDraft();
        textArea.focus();
        report('照片已插入正文。点击「预览」可以查看效果。');
      } catch (error) {
        if (editRevision === revision) report(error.message || '无法读取图片。', true);
      } finally {
        photoInput.disabled = false;
        photoInput.value = '';
        insertingPhoto = false;
        update();
      }
    });

    byId('preview-post').addEventListener('click', () => {
      const post = readPost();
      const preview = byId('post-preview');
      const body = element('div');
      renderMarkdown(body, post.body, photos);
      preview.replaceChildren(element('h3', post.title || '未命名文章'));
      if (post.summary) preview.append(element('p', post.summary, 'muted'));
      preview.append(body);
      preview.hidden = false;
    });

    postForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!base || insertingPhoto) return;
      const post = readPost();
      if (!post.title || (!activeSlug && !post.body)) {
        report('请填写文章标题和正文。', true);
        return;
      }
      const original = base.posts.find((item) => item.slug === activeSlug);
      const source = original || legacy.find((item) => item.slug === activeSlug);
      if (!activeSlug && [...base.posts, ...[...staged.values()].map((entry) => entry.post)]
          .some((item) => item.title === post.title && item.body === post.body)) {
        report('这篇文章已经发布或在待发布列表中。', true);
        return;
      }
      const prefix = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'post';
      const slug = source?.slug || prefix + '-' + crypto.randomUUID().slice(0, 12);
      const images = usedPhotos(post.body);
      if ([...post.body.matchAll(/!\[[^\]\n]*\]\(photo:([a-f0-9]{12})\)/g)]
            .some((match) => !images.some(({ id }) => id === match[1]))) {
        report('正文里有一张缺失的照片。请重新插入该图，或删除对应的图片标记。', true);
        return;
      }
      const timestamp = new Date().toISOString();
      const tags = parseTags(post.tags);
      if (!validTags(tags)) {
        report('最多可填写 6 个标签，每个标签最多 24 个字。', true);
        return;
      }
      const item = { ...original, ...post, tags, slug, date: source?.date || timestamp, updatedAt: timestamp, photos: images };
      staged.set(slug, { post: item, original, editing: Boolean(source) });
      invalidateOutput();
      update();
      report(source ? '文章修改已加入待发布，发布后会替换原文。' : '新文章已加入待发布。');
    });

    avatarInput.addEventListener('change', async () => {
      const token = ++selection;
      candidate = undefined;
      update();
      try {
        const image = await prepareImage(avatarInput.files[0], true);
        if (token !== selection) return;
        candidate = image;
        displayAvatar(image);
        report('头像预览已更新。点击「使用此头像」加入待发布。');
      } catch (error) {
        if (token !== selection) return;
        displayAvatar(avatar || base?.avatar);
        report(error.message || '无法读取图片。', true);
      }
      update();
    });

    avatarForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!base || !candidate) return;
      avatar = candidate;
      invalidateOutput();
      update();
      report('新头像已加入待发布。');
    });

    prepare.addEventListener('click', async () => {
      preparing = true;
      update();
      invalidateOutput();
      try {
        const latest = await loadContent();
        if (avatar && latest.avatar !== base.avatar && latest.avatar !== avatar) {
          throw new Error('线上头像已被更新。请刷新管理页，确认后重新选择头像。');
        }
        const merged = new Map(latest.posts.map((post) => [post.slug, post]));
        for (const { post, original, editing } of staged.values()) {
          const current = merged.get(post.slug);
          if (editing && JSON.stringify(current) !== JSON.stringify(original)
              && JSON.stringify(current) !== JSON.stringify(post)) {
            throw new Error('「' + post.title + '」已被其他提交修改。请刷新并重新编辑。');
          }
          if (editing || ![...merged.values()].some((item) => item.slug === post.slug
              || (item.title === post.title && item.body === post.body))) merged.set(post.slug, post);
        }
        const data = { ...latest, avatar: avatar || latest.avatar, posts: [...merged.values()] };
        const file = JSON.stringify(data, null, 2) + '\n';
        if (new Blob([file]).size > 20 * 1024 * 1024) throw new Error('发布文件超过 20 MB。请减少正文图片后重试。');
        byId('publish-output').value = file;
        byId('manual-copy').hidden = true;
        byId('publish-steps').hidden = false;
        if (new Blob([file]).size > 750000) {
          report('发布文件较大。请点击「下载发布文件」，再打开 GitHub 上传页提交。');
          return;
        }
        try {
          await navigator.clipboard.writeText(file);
          report('发布内容已复制。接下来打开 GitHub 编辑页，粘贴并提交。');
        } catch {
          byId('manual-copy').hidden = false;
          byId('publish-output').focus();
          byId('publish-output').select();
          report('浏览器未授权自动复制。请手动复制已选中的发布内容。');
        }
      } catch (error) {
        report(error.message || '暂时无法生成发布内容，请重试。', true);
      } finally {
        preparing = false;
        update();
      }
    });

    byId('download-content').addEventListener('click', () => {
      const file = byId('publish-output').value;
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
      const link = element('a');
      link.href = url;
      link.download = 'blog-content.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });

    loadContent().then((data) => {
      base = data;
      displayAvatar(candidate || data.avatar);
      for (const post of allPosts(data)) {
        const option = element('option', post.title);
        option.value = post.slug;
        editor.append(option);
      }
      openDraft();
      report('当前内容已就绪。草稿保存在此浏览器，提交到 GitHub 后才会公开。');
      update();
    }).catch(() => report('暂时无法读取已发布内容。请刷新后重试，避免覆盖线上文章。', true));
  }

  initTheme();
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'article') initArticle();
  if (page === 'studio') initStudio();
})();
