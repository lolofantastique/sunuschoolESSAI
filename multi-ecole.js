/* SunuSchool — couche multi-écoles (version de test) : code d'école à la connexion, nom de l'école, activation de comptes */
(function(){
  'use strict';
  var CFG=window.SUNUCONFIG||{}, KEY='ecole_code', DEFAULT_CODE='ya-fatou';
  var $=function(id){return document.getElementById(id);};
  function toast(m){ try{ showToast(m); }catch(_){ alert(m); } }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function code(){
    var i=$('ecole-code-input'), v=i?i.value:'';
    v=String(v||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
    return v||DEFAULT_CODE;
  }

  /* 1. Champ « Code de l'école » dans la fenêtre de connexion */
  function addCodeField(){
    var id=$('login-id-input'); if(!id||$('ecole-code-input')) return;
    var wrap=document.createElement('div');
    wrap.className='space-y-1';
    wrap.innerHTML='<label class="block text-xs font-bold text-slate-700" for="ecole-code-input">Code de l’école</label>'+
      '<input id="ecole-code-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" class="w-full border border-slate-300 rounded-xl px-3 py-2 font-mono text-sm" placeholder="ex : ya-fatou">';
    var anchor=id.closest('label')||id;
    anchor.parentNode.insertBefore(wrap,anchor);
    var inp=$('ecole-code-input'), saved='';
    try{ saved=localStorage.getItem(KEY)||''; }catch(_){}
    inp.value=saved||DEFAULT_CODE;
    inp.addEventListener('change',function(){ try{ localStorage.setItem(KEY,code()); }catch(_){} });
  }

  /* 2. L'e-mail interne contient le code de l'école : matricule.code@domaine */
  function wrapAuth(){
    var sb=window.sb; if(!sb||!sb.auth||sb.auth.__ecole) return false;
    var orig=sb.auth.signInWithPassword.bind(sb.auth);
    sb.auth.signInWithPassword=function(c){
      if(c&&typeof c.email==='string'){
        var at=c.email.lastIndexOf('@'), local=at>0?c.email.slice(0,at):c.email;
        c=Object.assign({},c,{email:local+'.'+code()+'@'+(CFG.emailDomain||c.email.slice(at+1))});
        try{ localStorage.setItem(KEY,code()); }catch(_){}
      }
      return orig(c);
    };
    sb.auth.__ecole=true;
    return true;
  }

  /* 3. Nom de l'école lu dans la base (remplace le texte « Groupe Scolaire Al-Amine ») */
  var schoolName=null;
  function replaceNames(root){
    if(!schoolName) return;
    var w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT,null), n, list=[];
    while((n=w.nextNode())){ if(/Al-?Amine/i.test(n.nodeValue)) list.push(n); }
    list.forEach(function(t){ t.nodeValue=t.nodeValue.replace(/Groupe Scolaire Al-?Amine/gi,schoolName).replace(/Al-?Amine/gi,schoolName); });
    if(/Al-?Amine/i.test(document.title)) document.title=document.title.replace(/Groupe Scolaire Al-?Amine/gi,schoolName).replace(/Al-?Amine/gi,schoolName);
  }
  async function loadSchool(){
    try{
      var r=await window.sb.from('schools').select('name').maybeSingle();
      if(r&&r.data&&r.data.name){ schoolName=r.data.name; replaceNames(); }
    }catch(e){ console.warn('école',e); }
  }
  var pend=false;
  new MutationObserver(function(){
    if(!schoolName||pend) return; pend=true;
    requestAnimationFrame(function(){ pend=false; replaceNames(); });
  }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  /* 4. Administration : activer le compte d'une fiche existante (élève ou enseignant sans compte) */
  function addActivation(){
    var m=$('b5-adm'); if(!m||$('ecole-act-box')) return;
    var own=$('b5-adm-own'); if(!own) return;
    var box=document.createElement('div');
    box.id='ecole-act-box'; box.className='border-t border-slate-200 pt-3 space-y-2';
    box.innerHTML='<p class="text-xs font-bold text-slate-700">Activer le compte d’une fiche existante</p>'+
      '<p class="text-xs text-slate-500">Pour un élève ou un enseignant déjà enregistré mais sans mot de passe.</p>'+
      '<div class="flex gap-2"><input id="ecole-act-mat" type="text" autocomplete="off" autocapitalize="characters" placeholder="Matricule" class="flex-1 border border-slate-300 rounded-xl px-3 py-2 font-mono text-sm">'+
      '<button type="button" id="ecole-act-btn" class="bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs px-4 rounded-xl">Activer</button></div>'+
      '<div id="ecole-act-res" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-sm space-y-1"></div>';
    own.parentNode.insertBefore(box,own);
    $('ecole-act-btn').onclick=async function(){
      if(typeof currentRole==='undefined'||currentRole!=='admin') return toast('🔒 Réservé à l’administration.');
      var mat=$('ecole-act-mat').value.trim().toUpperCase(); if(!mat) return;
      var btn=this; btn.disabled=true;
      try{
        var r=await window.sb.functions.invoke('create-account',{body:{action:'activate',matricule:mat}});
        if(r.error){ var d=r.error.message; try{ var j=await r.error.context.json(); if(j&&j.error) d=j.error; }catch(_){} throw new Error(d); }
        if(r.data&&r.data.error) throw new Error(r.data.error);
        var o=r.data, res=$('ecole-act-res');
        res.innerHTML='<p class="font-bold text-emerald-800">Compte activé ✅</p><p>Nom : <b>'+esc(o.full_name)+'</b></p><p>Matricule : <b class="font-mono text-sky-700">'+esc(o.matricule)+'</b></p><p>Mot de passe : <b class="font-mono text-emerald-700 text-lg tracking-widest">'+esc(o.password)+'</b></p>';
        res.classList.remove('hidden'); $('ecole-act-mat').value='';
      }catch(err){ toast('⚠️ '+(err&&err.message||err)); }
      finally{ btn.disabled=false; }
    };
  }

  var wrapped=false, loaded=false;
  setInterval(function(){
    addCodeField();
    if(!wrapped) wrapped=wrapAuth();
    addActivation();
    if(window.sb&&!loaded&&typeof currentRole!=='undefined'&&currentRole){ loaded=true; loadSchool(); }
  },500);
})();
