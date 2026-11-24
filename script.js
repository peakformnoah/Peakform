(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const root=document.body.dataset.root||'./';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const local=u=>{if(typeof u==='string'&&u.startsWith('../assets/')&&root==='../'&&!u.slice(3).includes('..'))return u;if(typeof u!=='string'||!u||/^(?:[a-z]+:|\/\/)/i.test(u)||u.includes('..'))return '';return root+u.replace(/^\//,'');};
 const external=(value,hosts)=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:'';}catch{return '';}};
 $$('[data-year]').forEach(n=>n.textContent=new Date().getFullYear());
 const menu=$('.menu-toggle'),nav=$('#main-nav');
 function closeMenu(){nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','메뉴 열기');}
 menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
 nav?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
 const seasonData=[['OFF-SEASON','다시 쌓는 기반','체력 회복과 근력 향상, 약점 부위 보완에 집중합니다.','기초 체력 · 근력 · 보완',[35,45,55,50,65,72,66,80,87,75,90,98]],['PRE-SEASON','경기를 준비하는 힘','근력과 파워를 스피드·민첩성으로 연결합니다.','파워 · 스피드 · 민첩성',[55,72,63,85,76,95,88,78,92,81,72,68]],['IN-SEASON','시즌을 이어가는 관리','경기력 유지와 피로 관리를 함께 고려합니다.','유지 · 피로 관리 · 보강',[68,45,75,40,70,45,65,38,72,40,68,45]],['COMPETITION','필요한 순간에 맞춘 컨디션','경기 일정을 중심으로 훈련량과 회복의 균형을 조정합니다.','컨디셔닝 · 회복 · 테이퍼링',[70,65,55,60,45,50,38,42,30,35,25,22]]];
 const tabs=$$('[data-season]');
 function setSeason(i,focus=false){tabs.forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1;});const d=seasonData[i];$('#season-panel').setAttribute('aria-labelledby',tabs[i].id);['en','title','desc','tags'].forEach((k,j)=>$('#season-'+k).textContent=d[j]);$$('.season-visual span').forEach((b,j)=>b.style.height=d[4][j]+'%');if(focus)tabs[i].focus();}
 tabs.forEach((b,i)=>{b.onclick=()=>setSeason(i);b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%4;if(e.key==='ArrowLeft')next=(i+3)%4;if(e.key==='Home')next=0;if(e.key==='End')next=3;if(next!==undefined){e.preventDefault();setSeason(next,true);}};});
 fetch(root+'content/site.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(s=>{
   $$('[data-setting]').forEach(n=>{if(typeof s[n.dataset.setting]==='string')n.textContent=s[n.dataset.setting];});
   $$('[data-pricing]').forEach(n=>n.hidden=s.showPricing!==true);
   $$('[data-unit]').forEach(cell => {
     const count = Number(cell.dataset.unit);
     const total = Number(String(s['price'+count]).replace(/,/g,''));
     if (Number.isFinite(total) && total > 0 && count > 0) {
       cell.textContent = Math.round(total / count).toLocaleString('ko-KR') + '원';
     }
   });
   if (s.showPricing === true && location.hash === '#fees') $('#fees')?.scrollIntoView({behavior:'instant', block:'start'});
   $$('[data-coach]').forEach(n=>{if(s.showCoach===true&&s.coachName?.trim()&&s.coachBio?.trim()){n.hidden=false;n.innerHTML=`<div class="split"><div><p class="eyebrow">YOUR COACH</p><h2>움직임을 함께 만드는 사람.</h2></div><div><h3 class="coach-name">${esc(s.coachName)} <small>코치</small></h3><p class="coach-bio">${esc(s.coachBio)}</p>${s.coachCredentials?'<ul>'+s.coachCredentials.split('\n').filter(Boolean).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':''}</div></div>`;}});
   $$('[data-contact]').forEach(n=>{const out=[];if(s.phone&&/^[+\d()\s-]{7,30}$/.test(s.phone))out.push(`<a href="tel:${s.phone.replace(/[^+\d]/g,'')}">전화 상담 <span>${esc(s.phone)} ↗</span></a>`);if(s.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))out.push(`<a href="mailto:${esc(s.email)}">이메일 <span>${esc(s.email)} ↗</span></a>`);for(const [k,label,hosts] of [['kakao','카카오톡 상담',['pf.kakao.com','open.kakao.com']],['instagram','인스타그램',['instagram.com']]]){const u=external(s[k],hosts);if(u)out.push(`<a href="${esc(u)}" target="_blank" rel="noopener">${label}<span>↗</span></a>`);}for(const [k,label] of [['address','위치'],['hours','운영시간']])if(s[k])out.push(`<div class="contact-detail"><strong>${label}</strong>${esc(s[k])}</div>`);if(out.length)n.innerHTML=out.join('');});
 }).catch(()=>{});
 const feeds=$$('[data-feed]'); let allPosts=[],filter='all',query='';
 const cats={notice:'공지사항',class:'트레이닝 이야기',event:'팀 · 현장 이야기',competition:'대회 소식'};
 function draw(){feeds.forEach(n=>{let posts=allPosts.filter(p=>(filter==='all'||p.category===filter)&&((p.title||'')+' '+(p.excerpt||'')).toLowerCase().includes(query.toLowerCase()));if(n.dataset.limit)posts=posts.slice(0,Number(n.dataset.limit));if(!posts.length){n.innerHTML='<div class="journal-empty"><p class="eyebrow">OUR NEXT CHAPTER</p><h3>'+((query||filter!=='all')?'조건에 맞는 소식이 없습니다.':'피크폼의 이야기가 이곳에 쌓입니다.')+'</h3><p>'+((query||filter!=='all')?'검색어나 분류를 바꿔 보세요.':'트레이닝 현장과 새로운 소식을 전하겠습니다.')+'</p></div>';return;}n.innerHTML=posts.map(p=>{const asset=p.media?.[p.coverId],src=local(asset?.poster||asset?.url),href=local(p.url),date=(p.publishedAt||'').slice(0,10).replaceAll('-','.');return href?`<a class="journal-card" href="${esc(href)}"><div class="journal-cover">${src?`<img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy">`:'PEAKFORM'}</div><div class="journal-meta"><span>${esc(cats[p.category]||'피크폼 소식')}</span><time>${esc(date)}</time></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></a>`:'';}).join('');});}
 if(feeds.length){const config=window.PEAKFORM_CONTENT_CONFIG||{};const feed=config.feed?.startsWith('/')?config.feed:root+(config.feed||'content/posts.json');fetch(feed,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{allPosts=Array.isArray(d.posts)?d.posts:[];allPosts.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));draw();}).catch(()=>{feeds.forEach(n=>n.innerHTML='<div class="journal-empty"><h3>소식을 불러오지 못했습니다.</h3><p>잠시 뒤 새로고침해 주세요.</p><button type="button" data-reload>다시 불러오기</button></div>');$$('[data-reload]').forEach(b=>b.onclick=()=>location.reload());});}
 $$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});draw();});
 $('[data-search]')?.addEventListener('input',e=>{query=e.target.value;draw();});
 const dialog=$('#image-dialog');dialog?.querySelector('button').addEventListener('click',()=>dialog.close());document.addEventListener('click',e=>{const b=e.target.closest('[data-image-open]');if(!b||!dialog)return;const src=local(b.dataset.imageOpen);if(!src)return;const img=dialog.querySelector('img');img.src=src;img.alt=b.querySelector('img')?.alt||'';dialog.showModal();});dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
})();
