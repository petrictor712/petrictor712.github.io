(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const contentUrl = '/blog-content.json';
  const draftKey = 'chen-journal-draft-v1';
  const avatarPattern = /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/=]+$/i;
  const slugPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;
  const legacy = [
    { title: 'my-test-draft', url: '/2024/05/10/my-test-draft/', cover: '/images/blog-draft.webp' },
    { title: 'mt-tset-post', url: '/2024/05/10/mt-tset-post/', cover: '/images/blog-test.webp' },
    { title: 'Hello World', url: '/2024/05/10/hello-world/', cover: '/images/blog-hello.webp', summary: 'Hexo 入门示例，包含写作、预览和部署命令。' },
  ].map((post) => ({ ...post, date: '2024-05-10' }));
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long', timeZone: 'Asia/Shanghai',
  });

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function validAvatar(src) {
    return typeof src === 'string' && src.length < 180000 && avatarPattern.test(src);
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
          || !Number.isFinite(Date.parse(post.date))) {
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

  function renderMarkdown(container, markdown) {
    container.replaceChildren();
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

  function renderCard(post) {
    const card = element('article', undefined, 'card');
    const link = element('a');
    link.href = post.url || '/article.html?p=' + encodeURIComponent(post.slug);
    const body = element('div', undefined, 'card-body');
    const arrow = element('span', '↗', 'card-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    body.append(timeLabel(post.date), element('h3', post.title), arrow);
    if (post.summary) body.append(element('p', post.summary));
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
    let posts = legacy;

    const update = () => {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches = posts.filter((post) => {
        const text = [post.title, post.summary, post.body].join(' ').toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      });
      byId('result-count').textContent = matches.length + ' 篇文章';
      grid.replaceChildren(...matches.map(renderCard));
      if (!matches.length) grid.append(element('p', '没有找到匹配的文章。', 'muted'));
    };

    search.addEventListener('input', update);
    try {
      const data = await loadContent();
      displayAvatar(data.avatar);
      posts = [...data.posts, ...legacy].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    } catch {
      byId('feed-status').textContent = '暂时无法刷新新文章，已显示归档中的文章。';
    }
    update();
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
      renderMarkdown(byId('article-body'), post.body);
      byId('article').hidden = false;
      status.hidden = true;
    } catch {
      status.textContent = '暂时无法读取文章，请刷新后重试。';
    }
  }

  async function prepareAvatar(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    }
    if (file.size > 12 * 1024 * 1024) throw new Error('请选择小于 12 MB 的图片。');
    const image = await createImageBitmap(file);
    try {
      const size = Math.min(image.width, image.height);
      const canvas = element('canvas');
      canvas.width = canvas.height = Math.min(size, 384);
      const context = canvas.getContext('2d');
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, canvas.width, canvas.height);
      const avatar = canvas.toDataURL('image/webp', .8);
      if (!validAvatar(avatar)) throw new Error('无法将图片压缩到发布大小，请换一张较小的图片。');
      return avatar;
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
    const postFields = ['title', 'summary', 'body'];
    const posts = [];
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
      for (const post of posts) {
        const row = element('li', post.title + ' ');
        const remove = element('button', '撤销', 'button small');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          posts.splice(posts.indexOf(post), 1);
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
      prepare.disabled = !base || (!posts.length && !avatar);
      postSubmit.disabled = !base;
      avatarSubmit.disabled = !base || !candidate;
    };

    const readPost = () => Object.fromEntries(postFields.map((name) => [name, postForm.elements[name].value.trim()]));
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || '{}');
      for (const name of postFields) if (typeof draft[name] === 'string') postForm.elements[name].value = draft[name];
    } catch {
      // Editing remains available when the browser blocks storage.
    }
    postForm.addEventListener('input', () => {
      try { localStorage.setItem(draftKey, JSON.stringify(readPost())); } catch { /* Storage is optional. */ }
    });

    byId('preview-post').addEventListener('click', () => {
      const post = readPost();
      const preview = byId('post-preview');
      const body = element('div');
      renderMarkdown(body, post.body);
      preview.replaceChildren(element('h3', post.title || '未命名文章'));
      if (post.summary) preview.append(element('p', post.summary, 'muted'));
      preview.append(body);
      preview.hidden = false;
    });

    postForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!base) return;
      const post = readPost();
      if (!post.title || !post.body) {
        report('请填写文章标题和正文。', true);
        return;
      }
      if ([...base.posts, ...posts].some((item) => item.title === post.title && item.body === post.body)) {
        report('这篇文章已经发布或在待发布列表中。', true);
        return;
      }
      const prefix = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'post';
      posts.push({ ...post, slug: prefix + '-' + crypto.randomUUID().slice(0, 12), date: new Date().toISOString() });
      invalidateOutput();
      update();
      report('文章已加入待发布。可以继续写作，或复制发布内容。');
    });

    avatarInput.addEventListener('change', async () => {
      const token = ++selection;
      candidate = undefined;
      update();
      try {
        const image = await prepareAvatar(avatarInput.files[0]);
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
      prepare.disabled = true;
      invalidateOutput();
      try {
        const latest = await loadContent();
        if (avatar && latest.avatar !== base.avatar && latest.avatar !== avatar) {
          throw new Error('线上头像已被更新。请刷新管理页，确认后重新选择头像。');
        }
        const newPosts = posts.filter((post) => !latest.posts.some((item) => item.slug === post.slug || (item.title === post.title && item.body === post.body)));
        const data = { ...latest, avatar: avatar || latest.avatar, posts: [...latest.posts, ...newPosts] };
        const file = JSON.stringify(data, null, 2) + '\n';
        byId('publish-output').value = file;
        byId('manual-copy').hidden = true;
        byId('publish-steps').hidden = false;
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
      }
      update();
    });

    loadContent().then((data) => {
      base = data;
      displayAvatar(candidate || data.avatar);
      report('当前内容已就绪。草稿保存在此浏览器，提交到 GitHub 后才会公开。');
      update();
    }).catch(() => report('暂时无法读取已发布内容。请刷新后重试，避免覆盖线上文章。', true));
  }

  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'article') initArticle();
  if (page === 'studio') initStudio();
})();
