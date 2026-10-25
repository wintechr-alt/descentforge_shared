(function(){
const KEY='descentforge_forge_data_v1';
function clone(v){return JSON.parse(JSON.stringify(v||[]));}
let state={weaponParts:[]};
try{const r=localStorage.getItem(KEY);if(r){const p=JSON.parse(r);if(Array.isArray(p.weaponParts))state.weaponParts=p.weaponParts;}}catch(e){}
if(!Array.isArray(state.weaponParts)||!state.weaponParts.length)state.weaponParts=clone((typeof DATA!=="undefined")?DATA.weaponParts:[]);
if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({weaponParts:state.weaponParts}));}catch(e){};if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function prettyName(s){return String(s==null?'':s).replace(//g,' Plus').replace(/^\s+|\s+$/g,'');}
const overlay=document.createElement('div');
overlay.id='forgeOverlay';
overlay.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:10005;display:none;background:var(--board);color:var(--text);font-family:inherit;overflow:hidden;';
overlay.innerHTML=
  '<div style="padding:10px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);"><h1 style="margin:0;font-size:18px;">Forge</h1></div>'+
  '<div style="display:flex;gap:8px;padding:8px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);justify-content:center;">'+
    '<button data-forgecat="armor" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Armor</button>'+
    '<button data-forgecat="trinkets" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Trinkets</button>'+
    '<button data-forgecat="weapons" style="padding:6px 12px;border:1px solid var(--edge);background:var(--torch);color:var(--ink);border-radius:4px;cursor:pointer;font-weight:600;">Weapons</button>'+
    '<button data-forgecat="enemies" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Enemies</button>'+
  '</div>'+
  '<div id="forgeMain" style="overflow:auto;height:calc(100% - 106px);padding:10px 18px;">'+
    '<div id="forgeSearchWrap">'+
      '<input id="forgeSearch" placeholder="Search weapon parts..." style="width:100%;padding:6px 8px;margin-bottom:8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+
      '<div id="forgeNew" style="padding:6px 10px;margin-bottom:8px;background:var(--torch);color:var(--ink);border-radius:4px;cursor:pointer;text-align:center;font-weight:600;">+ New weapon part</div>'+
    '</div>'+
    '<div id="forgeList"></div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>'+
  '</div>';
document.body.appendChild(overlay);
const HERO_NAMES=['HERO_BRYNN','HERO_SYRUS','HERO_GALADEN','HERO_VAERIX','HERO_KEHLI','HERO_CHANCE'];
const HERO_LABELS={'HERO_BRYNN':'Brynn','HERO_SYRUS':'Syrus','HERO_GALADEN':'Galaden','HERO_VAERIX':'Vaerix','HERO_KEHLI':'Kehli','HERO_CHANCE':'Chance'};
const HERO_weapons={'HERO_BRYNN':['Sword','Warhammer'],'HERO_SYRUS':['Staff','Wand'],'HERO_GALADEN':['DualBlades','Bow'],'HERO_VAERIX':['Warbell','Spear'],'HERO_KEHLI':['Hammer','Crossbow'],'HERO_CHANCE':['Gauntlet','ThrowingKnives']};
let selectedHero='HERO_BRYNN';
let activeCat='weapons';
let selected=null;
const carIdx={};
function carKey(cls,slot){return cls+'|'+slot;}
function partVariants(cls,slot){return state.weaponParts.filter(function(w){return w.class===cls && w.slot===slot;}).sort(function(a,b){return a.id>b.id?1:-1;});}
function carouselItems(cls,slot){return partVariants(cls,slot).filter(function(w){return inStartInv(w.id);});}
function inStartInv(id){try{return !!(typeof camp!=='undefined' && camp.start && Array.isArray(camp.start.items) && camp.start.items.some(function(i){return i.id===id;}));}catch(e){return false;}}
function setStartInv(id,on){try{if(typeof camp==='undefined'||!camp) return; camp.start=camp.start||{items:[]}; if(!Array.isArray(camp.start.items)) camp.start.items=[]; if(on){if(!camp.start.items.some(function(i){return i.id===id;})) camp.start.items.push({id:id,qty:1});}else{camp.start.items=camp.start.items.filter(function(i){return i.id!==id;});} if(typeof renderRight==='function') renderRight();}catch(e){}}
const classes=Array.from(new Set(state.weaponParts.map(function(x){return x.class;}))).sort();
function renderList(){
  const q=(overlay.querySelector('#forgeSearch').value||'').toLowerCase();
  const list=overlay.querySelector('#forgeList');
  list.innerHTML='';
  state.weaponParts.slice().sort(function(a,b){return a.id>b.id?1:-1;}).filter(function(p){return !q||String(p.id).toLowerCase().includes(q)||String(p.name_en||'').toLowerCase().includes(q);}).forEach(function(p){
    const d=document.createElement('div');
    d.style.cssText='padding:8px;margin-bottom:4px;background:var(--panel2);border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;';
    if(p.id===selected)d.style.outline='1px solid var(--torch)';
    const img=document.createElement('img');img.src='../img/weapon/'+p.id+'.png';img.style.cssText='width:28px;height:28px;object-fit:contain;background:var(--ink);border-radius:3px;';
    img.onerror=function(){img.style.display='none';};
    const span=document.createElement('span');span.textContent=p.id;
    d.appendChild(img);d.appendChild(span);
    d.addEventListener('click',function(){selected=p.id;renderAll();});
    list.appendChild(d);
  });
}
function makeSelect(id,values,cur){let h='<select id="'+id+'" style="width:100%;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;margin-top:4px;box-sizing:border-box;">';values.forEach(function(v){h+='<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(v)+'</option>';});h+='</select>';return h;}
function fields(p){
  return '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">ID</label><input id="wId" value="'+esc(p.id)+'" style="width:100%;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Name (ES)</label><input id="wName" value="'+esc(p.name)+'" style="width:100%;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Name (EN)</label><input id="wNameEn" value="'+esc(p.name_en)+'" style="width:100%;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Class</label>'+makeSelect('wClass',classes,p.class)+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Slot</label>'+makeSelect('wSlot',['A','B','C'],p.slot)+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;"><input id="wUpgraded" type="checkbox"'+(p.upgrade?' checked':'')+' style="margin-right:6px;">Upgraded</label>'+
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Flavor text</label><textarea id="wText" style="width:100%;min-height:48px;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+esc(p.text||'')+'</textarea>'+
  '<div style="margin-top:12px;display:flex;gap:8px;">'+
    '<button id="wSave" style="background:var(--torch);color:var(--ink);font-weight:600;padding:6px 12px;border:0;border-radius:4px;cursor:pointer;">Save</button>'+
    '<button id="wDup" style="background:var(--edge);color:var(--text);padding:6px 12px;border:1px solid var(--edge);border-radius:4px;cursor:pointer;">Duplicate</button>'+
    '<button id="wDel" style="background:var(--edge);color:var(--text);padding:6px 12px;border:1px solid var(--edge);border-radius:4px;cursor:pointer;">Delete</button>'+
  '</div>'+
  '<p id="wMsg" style="color:var(--verd);font-size:12px;margin-top:8px;"></p>';
}
function bindEditor(p){
  const msg=overlay.querySelector('#wMsg');
  const sync=function(){
    p.id=overlay.querySelector('#wId').value;
    p.name=overlay.querySelector('#wName').value;
    p.name_en=overlay.querySelector('#wNameEn').value;
    p.class=overlay.querySelector('#wClass').value;
    p.slot=overlay.querySelector('#wSlot').value;
    p.upgrade=overlay.querySelector('#wUpgraded').checked;
    p.text=overlay.querySelector('#wText').value;
  };
  ['wId','wName','wNameEn','wClass','wSlot','wUpgraded','wText'].forEach(function(id){const el=overlay.querySelector('#'+id);if(el)el.addEventListener('input',sync);});
  const dup=overlay.querySelector('#wDup'); if(dup)dup.addEventListener('click',function(){sync();const c=clone(p);c.id=p.id+'_COPY';state.weaponParts.push(c);selected=c.id;persist();renderAll();});
  const del=overlay.querySelector('#wDel'); if(del)del.addEventListener('click',function(){state.weaponParts=state.weaponParts.filter(function(x){return x!==p;});selected=null;persist();renderAll();});
  const save=overlay.querySelector('#wSave'); if(save)save.addEventListener('click',function(){sync();persist();if(msg)msg.textContent='Saved';});
}
function renderEditor(){
  const e=overlay.querySelector('#forgeEditor');
  const p=state.weaponParts.find(function(x){return x.id===selected;});
  if(!p){e.innerHTML='<p style="color:var(--dim);">Select a weapon part to edit, or create a new one.</p>';return;}
  e.innerHTML=fields(p);
  bindEditor(p);
}
function defaultPart(cls,slot){
  let arr=state.weaponParts.filter(function(w){return w.class===cls && w.slot===slot;}).sort(function(a,b){return a.id>b.id?1:-1;});
  // Prefer a variant that has an image (non-_0 suffix) for the assembled preview.
  const withImg=arr.filter(function(w){return !/_0$/.test(w.id);});
  if(withImg.length) arr=withImg;
  return arr.length?arr[0].id:null;
}
function renderHeroPortraits(){
  const el=overlay.querySelector('#forgeMain');
  if(!el) return;
  // keep hero list in left column via separate container
}
function carouselHTML(cls,slot,showImage){
  const arr=partVariants(cls,slot).filter(function(w){return inStartInv(w.id);});
  if(!arr.length) return '<div style="color:var(--dim);font-size:12px;text-align:center;padding:8px 0;">none</div>';
  let idx=carIdx[carKey(cls,slot)];
  if(idx==null || idx<0 || idx>=arr.length) idx=0;
  const p=arr[idx];
  const name=prettyName(p.name_en||p.name||p.id);
  const imgBaseId = String(p.id||'').replace(/_UPGRADED$/i,'').replace(/_PLUS$/i,'');
  const imgTag = showImage ? '<img src="../img/weapon/'+imgBaseId+'.png" style="width:100%;max-width:180px;aspect-ratio:1/1;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:6px;margin-bottom:6px;" onerror="this.style.display=&quot;none&quot;;">' : '';
  return '<div style="border:1px solid var(--edge);background:var(--panel);border-radius:6px;padding:8px;width:100%;max-width:240px;">'+
    '<div style="font-size:11px;color:var(--dim);margin-bottom:4px;">'+slot+' part ('+(idx+1)+'/'+arr.length+')</div>'+
    (imgTag? (imgTag+'<div style="margin-bottom:4px;"></div>') : '')+
    '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:6px;">'+
      '<button data-step="'+cls+'|'+slot+'|-1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&lt;</button>'+
      '<div style="flex:1;text-align:center;font-size:13px;word-break:break-word;">'+esc(name)+'</div>'+
      '<button data-step="'+cls+'|'+slot+'|1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&gt;</button>'+
    '</div>'+
    (flavor ? '<div style="color:var(--dim);font-size:11px;text-align:center;margin-bottom:6px;line-height:1.3;">'+esc(flavor)+'</div>' : '')+
    '<div style="margin-top:6px;text-align:center;"><button data-editpart="'+p.id+'" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">Edit</button></div>'+
  '</div>';
}
function renderHeroWeapons(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const classes=HERO_weapons[selectedHero]||[];
  const left='<div style="display:flex;flex-direction:column;gap:8px;width:120px;">'+
    HERO_NAMES.map(function(h){
      const on=h===selectedHero;
      return '<button data-hero="'+h+'" style="padding:10px 6px;background:'+(on?'var(--torch)':'var(--panel2)')+';color:'+(on?'var(--ink)':'var(--text)')+';border:1px solid var(--edge);border-radius:6px;cursor:pointer;font-weight:'+(on?'700':'400')+';">'+HERO_LABELS[h]+'</button>';
    }).join('')+
  '</div>';
  const columns=classes.map(function(cls){
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;border:1px solid var(--edge);background:var(--panel2);border-radius:8px;">'+
      '<div style="font-weight:600;margin-bottom:6px;">'+cls+'</div>'+
      carouselHTML(cls,'A',true)+
      '<div style="height:6px"></div>'+
      carouselHTML(cls,'B')+
      '<div style="height:6px"></div>'+
      carouselHTML(cls,'C')+
    '</div>';
  }).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;justify-content:center;">'+
      '<button id="forgeAddAllAct" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded for selected Acts</button>'+
      '<button id="forgeManageStart" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Manage Starting Inventory</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:130px 1fr;gap:12px;height:100%;">'+
      '<div style="display:flex;flex-direction:column;gap:8px;">'+left+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-content:start;">'+columns+'</div>'+
    '</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  main.querySelectorAll('[data-hero]').forEach(function(btn){
    btn.addEventListener('click',function(){ selectedHero=btn.getAttribute('data-hero'); renderHeroWeapons(); });
  });
  main.querySelectorAll('[data-selpart]').forEach(function(img){
    img.addEventListener('click',function(){ selected=img.getAttribute('data-selpart'); renderEditorTarget(); });
  });
  main.querySelectorAll('[data-step]').forEach(function(b){
    b.addEventListener('click',function(){
      const parts=b.getAttribute('data-step').split('|');
      const cls=parts[0], slot=parts[1], dir=+parts[2];
      const arr=carouselItems(cls,slot);
      if(!arr.length) return;
      const key=carKey(cls,slot);
      let idx=carIdx[key]||0;
      idx=(idx+dir+arr.length)%arr.length;
      carIdx[key]=idx;
      renderHeroWeapons();
    });
  });
  main.querySelectorAll('[data-editpart]').forEach(function(b){
    b.addEventListener('click',function(){ selected=b.getAttribute('data-editpart'); renderEditorTarget(); });
  });
  const addBtn=overlay.querySelector('#forgeAddAllAct');
  if(addBtn) addBtn.addEventListener('click',function(){
    try {
      const allowedAct2= (typeof camp!=='undefined' && camp.meta && (camp.meta.act!=='I' || !!camp.meta.requiresAct2)) || false;
      if(typeof camp==='undefined'){ console.warn('no camp'); return; }
      camp.start=camp.start||{items:[]};
      if(!Array.isArray(camp.start.items)) camp.start.items=[];
      const ids=[];
      if(typeof GRUPOS_INICIO==='function'){
        GRUPOS_INICIO().filter(function(g){return g&&g[0]!=='loot';}).forEach(function(g){
          (g[1]||[]).forEach(function(x){
            const id=String(x.id||'');
            if(!id) return;
            if(typeof esMejoraStart==='function' && !esMejoraStart(id)) return;
            const act=(typeof itemActOf==='function')? itemActOf(x) : 1;
            if(act>=2 && !allowedAct2) return;
            ids.push(id);
          });
        });
      } else {
        state.weaponParts.forEach(function(w){
          if(/_UPGRADED$/.test(w.id)) ids.push(w.id);
        });
      }
      const seen=new Set();
      ids.filter(function(id){ if(seen.has(id)) return false; seen.add(id); return true; }).forEach(function(id){
        if(typeof addStartItem==='function') addStartItem(id);
        else if(!camp.start.items.some(function(i){return i.id===id;})) camp.start.items.push({id:id,qty:1});
      });
      if(typeof renderRight==='function') renderRight();
    } catch(e){ console.error('ADD_ALL_ERR', e && (e.stack||e)); }
    renderHeroWeapons();
  });
  const manageBtn=overlay.querySelector('#forgeManageStart');
  if(manageBtn) manageBtn.addEventListener('click',function(){
    if(typeof abrirInicioPopup==='function') abrirInicioPopup();
  });
}

function renderEditorTarget(){
  const e=overlay.querySelector('#forgeEditor');
  if(!e) return;
  const p=state.weaponParts.find(function(x){return x.id===selected;});
  if(!p){ e.innerHTML=''; return; }
  e.innerHTML=fields(p);
  bindEditor(p);
}
function renderSimpleCategory(title, items, imgFolder){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const rows=items.map(function(x){
    const name = prettyName((typeof L==='function') ? L(x,'name') : (x.name_en||x.name||x.id));
    const isIn=inStartInv(x.id);
    const img = imgFolder ? '<img src="../img/'+imgFolder+'/'+x.id+'.png" style="width:34px;height:34px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">' : '';
    return '<div style="padding:8px;margin-bottom:6px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
      '<div style="display:flex;align-items:center;gap:8px;">'+img+'<span>'+esc(name)+'</span></div>'+
      '<span style="font-size:11px;color:'+(isIn?'var(--verd)':'var(--dim)')+';">'+(isIn?'In Starting Inventory':'Not in Starting Inventory')+'</span>'+
    '</div>';
  }).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;">'+
      '<button id="forgeAddAllAct" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded for selected Acts</button>'+
      '<button id="forgeManageStart" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Manage Starting Inventory</button>'+
    '</div>'+
    '<h2 style="margin:0 0 8px 0;font-size:16px;">'+esc(title)+'</h2>'+
    '<div>'+ (rows||'<p style="color:var(--dim);">No items found.</p>') +'</div>';
  const addBtn=main.querySelector('#forgeAddAllAct');
  if(addBtn) addBtn.addEventListener('click',function(){
    const forgeAdd=document.getElementById('forgeAddAllAct');
    // reuse weapons add all handler via clicking virtual? Just run add all
    if (typeof addAllUpgradedGlobal==='function') addAllUpgradedGlobal();
    else {
      // fallback
    }
    renderActiveCategory();
  });
  const manageBtn=main.querySelector('#forgeManageStart');
  if(manageBtn) manageBtn.addEventListener('click',function(){ if(typeof abrirInicioPopup==='function') abrirInicioPopup(); });
}
function renderArmorCategory(){ renderSimpleCategory('Armor', ((typeof DATA!=='undefined' && DATA.gear)? (DATA.gear.filter(function(g){return g.kind==='armor';})) : []), 'armor'); }
function renderTrinketsCategory(){ renderSimpleCategory('Trinkets', ((typeof DATA!=='undefined' && DATA.gear)? (DATA.gear.filter(function(g){return g.kind==='trinket';})) : []), 'trinket'); }
function renderEnemiesCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const items=(typeof DATA!=='undefined' && Array.isArray(DATA.enemies))? DATA.enemies : [];
  const rows=items.map(function(x){
    const name=prettyName(x.name_en||x.name||x.id);
    return '<div style="padding:8px;margin-bottom:6px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
      '<span>'+esc(name)+'</span></div>';
  }).join('');
  main.innerHTML=
    '<h2 style="margin:0 0 8px 0;font-size:16px;">Enemies</h2>'+
    '<div>' + (rows||'<p style="color:var(--dim);">No items found.</p>') + '</div>';
}
function renderActiveCategory(){ if(activeCat==='weapons') renderHeroWeapons(); else if(activeCat==='armor') renderArmorCategory(); else if(activeCat==='trinkets') renderTrinketsCategory(); else if(activeCat==='enemies') renderEnemiesCategory(); }
function renderAll(){}
function setCat(cat){
  activeCat=cat;
  overlay.querySelectorAll('[data-forgecat]').forEach(function(b){
    const on=b.getAttribute('data-forgecat')===cat;
    b.style.background=on?'var(--torch)':'var(--panel)';
    b.style.color=on?'var(--ink)':'var(--text)';
    b.style.fontWeight=on?'600':'400';
  });
  const searchWrap=overlay.querySelector('#forgeSearchWrap');
  const list=overlay.querySelector('#forgeList');
  const editor=overlay.querySelector('#forgeEditor');
  if(cat==='weapons'){
    if(searchWrap) searchWrap.style.display='none';
    if(list) list.style.display='none';
    renderHeroWeapons();
  } else {
    if(searchWrap) searchWrap.style.display='none';
    if(list) list.innerHTML='';
    if(editor) editor.innerHTML='';
    renderActiveCategory();
  }
}
overlay.querySelectorAll('[data-forgecat]').forEach(function(b){
  b.addEventListener('click',function(){ setCat(b.getAttribute('data-forgecat')); });
});
overlay.querySelector('#forgeSearch').addEventListener('input',function(){ if(activeCat==='weapons') renderList(); });
overlay.querySelector('#forgeNew').addEventListener('click',function(){const c={id:'WEAPON_PART_NEW',name:'New Part',name_en:'New Part',class:'Rune',slot:'A',upgrade:false};state.weaponParts.push(c);selected=c.id;persist();renderAll();});
const modesel=document.getElementById('modesel');
const btn=document.createElement('button');
btn.textContent='Forge'; btn.id='forgeBtn'; btn.setAttribute('data-forge','1');
if(modesel) modesel.appendChild(btn);
function placeForge(){ var h=document.querySelector('header'); var top=h?(h.getBoundingClientRect().bottom||h.offsetHeight||0):0; overlay.style.top=top+'px'; }
function openForge(){ placeForge(); overlay.style.display='block'; btn.classList.add('on'); renderActiveCategory(); }
function closeForge(){ overlay.style.display='none'; btn.classList.remove('on'); }
btn.addEventListener('click',function(){ if(overlay.style.display==='block') closeForge(); else openForge(); });
function showForgeContent(){ setCat(activeCat); }
window.addEventListener('resize',function(){ if(overlay.style.display==='block') placeForge(); });
if(modesel){
  modesel.addEventListener('click',function(e){ const real=e.target.closest('[data-mode]'); if(real) closeForge(); });
}
})();
