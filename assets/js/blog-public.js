(() => {
  const cfg=window.NTA_CONFIG||{};
  const $=(q,r=document)=>r.querySelector(q);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'';
  const starterImages={
    'how-to-choose-the-right-equipment-for-a-freight-shipment':'assets/images/services-hero.webp',
    'planning-multi-load-and-jobsite-transportation':'assets/images/industries-hero.webp',
    'carrier-onboarding-what-brokers-need-before-tendering-freight':'assets/images/carriers-hero.webp',
    'what-information-helps-a-freight-quote-move-faster':'assets/images/shippers-hero.webp'
  };
  const postImage=p=>p?.featured_image_url||starterImages[p?.slug]||'assets/images/blog-hero.webp';
  async function get(params=''){
    const r=await fetch(`${cfg.blogFunctionUrl}${params}`);
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw new Error(j.error||'Unable to load blog content.');
    return j;
  }

  const list=$('[data-cms-blog-list]');
  if(list){
    get('').then(j=>{
      const posts=j.posts||[];
      list.innerHTML=posts.map(p=>`<article class="cms-blog-card"><a class="cms-blog-image" href="blog-post.html?slug=${encodeURIComponent(p.slug)}" style="background-image:url('${postImage(p)}')"><span>${esc(p.nta_blog_categories?.name||'NTA Logistics')}</span></a><div class="cms-blog-body"><div class="cms-blog-meta">${date(p.published_at||p.scheduled_at||p.created_at)}${p.author_name?' · '+esc(p.author_name):''}</div><h3><a href="blog-post.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3><p>${esc(p.excerpt||'')}</p><a class="text-link" href="blog-post.html?slug=${encodeURIComponent(p.slug)}">Read article →</a></div></article>`).join('')||'<p>No published articles yet.</p>';
    }).catch(e=>list.innerHTML=`<div class="form-note">${esc(e.message)}</div>`);
  }

  const article=$('[data-blog-article]');
  if(article){
    const slug=new URLSearchParams(location.search).get('slug');
    if(!slug){article.innerHTML='<div class="form-note">Article not found.</div>';return;}
    Promise.all([get(`?slug=${encodeURIComponent(slug)}`),get('?limit=100')]).then(([j,listData])=>{
      const p=j.post;
      const posts=listData.posts||[];
      const idx=posts.findIndex(x=>x.slug===p.slug);
      const newer=idx>0?posts[idx-1]:null;
      const older=idx>=0&&idx<posts.length-1?posts[idx+1]:null;
      document.title=(p.seo_title||p.title)+' | NTA Logistics';
      const desc=document.querySelector('meta[name="description"]');
      if(desc)desc.content=p.seo_description||p.excerpt||'';
      if(p.canonical_url){let c=document.querySelector('link[rel="canonical"]');if(!c){c=document.createElement('link');c.rel='canonical';document.head.appendChild(c);}c.href=p.canonical_url;}
      const image=postImage(p);
      article.innerHTML=`
        <div class="article-nav article-nav-top"><a class="btn btn-outline" href="blog.html">← Back to Blog</a></div>
        <div class="article-hero-image"><img src="${image}" alt="${esc(p.featured_image_alt||p.title)}"></div>
        <div class="article-kicker">${esc(p.nta_blog_categories?.name||'NTA Logistics Blog')}</div>
        <h1>${esc(p.title)}</h1>
        <div class="article-meta">${date(p.published_at||p.scheduled_at||p.created_at)}${p.author_name?' · '+esc(p.author_name):''}</div>
        ${p.excerpt?`<p class="article-deck">${esc(p.excerpt)}</p>`:''}
        <div class="article-content">${p.content_html||''}</div>
        ${p.tags?.length?`<div class="article-tags">${p.tags.map(t=>`<span>${esc(t.name)}</span>`).join('')}</div>`:''}
        <nav class="article-pagination" aria-label="Blog article navigation">
          <div class="article-page-slot">${older?`<a class="article-page-link" href="blog-post.html?slug=${encodeURIComponent(older.slug)}"><span>← Previous article</span><strong>${esc(older.title)}</strong></a>`:'<span></span>'}</div>
          <a class="btn btn-gold article-blog-button" href="blog.html">All Blog Posts</a>
          <div class="article-page-slot article-page-slot-next">${newer?`<a class="article-page-link" href="blog-post.html?slug=${encodeURIComponent(newer.slug)}"><span>Next article →</span><strong>${esc(newer.title)}</strong></a>`:'<span></span>'}</div>
        </nav>`;
    }).catch(e=>article.innerHTML=`<div class="form-note">${esc(e.message)}</div>`);
  }
})();
