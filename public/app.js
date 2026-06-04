let articles = [];
const $ = id => document.getElementById(id);
async function request(url, options={}){
  const res = await fetch(url,{headers:{'Content-Type':'application/json'},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || '操作失败');
  return data;
}
async function checkMe(){
  const {user}=await request('/api/me');
  if(user){$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('userBox').innerHTML=`<span>已登录：${user.username}</span><button class="secondary" onclick="logout()">退出</button>`;loadArticles();}
  else {$('auth').classList.remove('hidden');$('app').classList.add('hidden');$('userBox').innerHTML='';}
}
async function register(){try{await request('/api/register',{method:'POST',body:JSON.stringify({username:$('username').value.trim(),password:$('password').value})});alert('注册成功，请登录');}catch(e){alert(e.message)}}
async function login(){try{await request('/api/login',{method:'POST',body:JSON.stringify({username:$('username').value.trim(),password:$('password').value})});checkMe();}catch(e){alert(e.message)}}
async function logout(){await request('/api/logout',{method:'POST'});checkMe();}
function formData(){return {title:$('title').value.trim(),disease:$('disease').value.trim(),platform:$('platform').value.trim(),word_count:$('word_count').value,audience:$('audience').value.trim(),section1:$('section1').value,section2:$('section2').value,section3:$('section3').value,section4:$('section4').value,summary:$('summary').value,image_notes:$('image_notes').value,status:'draft'}}
function fill(a={}){for(const id of ['articleId','title','disease','platform','word_count','audience','section1','section2','section3','section4','summary','image_notes'])$(id).value=a[id]||''; if(!a.id){$('articleId').value='';$('platform').value='医院公众号 / 小红书';$('word_count').value=500;$('audience').value='关注自身健康、无医学知识的普通群众';} else $('articleId').value=a.id; $('promptBox').classList.add('hidden')}
function newArticle(){fill({});$('title').focus()}
async function loadArticles(){const data=await request('/api/articles');articles=data.articles;$('articleList').innerHTML=articles.map(a=>`<div class="item" onclick="openArticle(${a.id})"><strong>${a.title}</strong><span>${a.disease} · ${a.updated_at}</span></div>`).join('')||'<p class="hint">暂无文章，点“新建”开始。</p>'; if(!articles.length)newArticle();}
function openArticle(id){const a=articles.find(x=>x.id===id); if(a)fill(a)}
async function saveArticle(){try{const id=$('articleId').value;const data=formData();if(!data.title||!data.disease) return alert('请填写内部标题和疾病/主题'); if(id) await request('/api/articles/'+id,{method:'PUT',body:JSON.stringify(data)}); else {const r=await request('/api/articles',{method:'POST',body:JSON.stringify(data)});$('articleId').value=r.id;} await loadArticles();alert('已保存');}catch(e){alert(e.message)}}
async function deleteArticle(){const id=$('articleId').value;if(!id)return alert('还没有选择文章');if(!confirm('确认删除这篇文章？'))return;await request('/api/articles/'+id,{method:'DELETE'});await loadArticles();newArticle();}
async function copyPrompt(){try{let id=$('articleId').value;if(!id){await saveArticle();id=$('articleId').value}const {prompt}=await request('/api/prompt/'+id);$('promptBox').textContent=prompt;$('promptBox').classList.remove('hidden');await navigator.clipboard.writeText(prompt);alert('提示词已复制，可以粘贴给 AI 生成文章');}catch(e){alert(e.message)}}
checkMe();
