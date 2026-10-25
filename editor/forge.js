(function(){
const KEY='descentforge_forge_data_v1';
function clone(v){return JSON.parse(JSON.stringify(v||[]));}
let state={weaponParts:[]};
try{const r=localStorage.getItem(KEY);if(r){const p=JSON.parse(r);if(Array.isArray(p.weaponParts))state.weaponParts=p.weaponParts;}}catch(e){}
if(!Array.isArray(state.weaponParts)||!state.weaponParts.length)state.weaponParts=clone((typeof DATA!=="undefined")?DATA.weaponParts:[]);
if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({weaponParts:state.weaponParts}));}catch(e){};if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const overlay=document.createElement('div');
overlay.id='forgeOverlay';
overlay.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:10005;display:none;background:var(--board);color:var(--text);font-family:inherit;overflow:hidden;';
overlay.innerHTML=
  '<div style="padding:10px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);"><h1 style="margin:0;font-size:18px;">Forge</h1></div>'+
  '<div style="display:flex;gap:8px;padding:8px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);">'+
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
  };
  ['wId','wName','wNameEn','wClass','wSlot','wUpgraded'].forEach(function(id){const el=overlay.querySelector('#'+id);if(el)el.addEventListener('input',sync);});
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
    const a=defaultPart(cls,'A');
    const b=defaultPart(cls,'B');
    const c=defaultPart(cls,'C');
    const img=function(id){ return id?'<img data-selpart="'+id+'" src="../img/weapon/'+id+'.png" style="width:100%;max-width:180px;aspect-ratio:1/1;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:6px;cursor:pointer;margin-bottom:8px;" onerror="this.style.display=&quot;none&quot;;">':'<div style="padding:20px;color:var(--dim);">no part</div>'; };
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border:1px solid var(--edge);background:var(--panel2);border-radius:8px;">'+
      '<div style="font-weight:600;margin-bottom:6px;">'+cls+'</div>'+
      img(a)+img(b)+img(c)+
    '</div>';
  }).join('');
  main.innerHTML=
    '<div style="display:grid;grid-template-columns:130px 1fr;gap:12px;height:100%;">'+
      '<div style="display:flex;flex-direction:column;gap:8px;">'+left+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-content:start;">'+columns+'</div>'+
    '</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  // hero button clicks
  main.querySelectorAll('[data-hero]').forEach(function(btn){
    btn.addEventListener('click',function(){ selectedHero=btn.getAttribute('data-hero'); renderHeroWeapons(); });
  });
  // part image clicks select that part for editing
  main.querySelectorAll('[data-selpart]').forEach(function(img){
    img.addEventListener('click',function(){ selected=img.getAttribute('data-selpart'); renderEditorTarget(); });
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
    if(editor) editor.innerHTML='<p style="color:var(--dim);">Coming soon: '+cat+' editor.</p>';
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
function openForge(){ placeForge(); overlay.style.display='block'; btn.classList.add('on'); if((activeCat||'weapons')==='weapons') renderHeroWeapons(); else setCat(activeCat||'weapons'); }
function closeForge(){ overlay.style.display='none'; btn.classList.remove('on'); }
btn.addEventListener('click',function(){ if(overlay.style.display==='block') closeForge(); else openForge(); });
function showForgeContent(){ setCat(activeCat); }
window.addEventListener('resize',function(){ if(overlay.style.display==='block') placeForge(); });
if(modesel){
  modesel.addEventListener('click',function(e){ const real=e.target.closest('[data-mode]'); if(real) closeForge(); });
}
})();
