(function(){
const KEY='descentforge_forge_data_v1';
function clone(v){return JSON.parse(JSON.stringify(v||[]));}
let state={weaponParts:[]};
try{const r=localStorage.getItem(KEY);if(r){const p=JSON.parse(r);if(Array.isArray(p.weaponParts))state.weaponParts=p.weaponParts;}}catch(e){}
if(!Array.isArray(state.weaponParts)||!state.weaponParts.length)state.weaponParts=clone((typeof DATA!=="undefined")?DATA.weaponParts:[]);
if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({weaponParts:state.weaponParts}));}catch(e){};if(typeof DATA!=="undefined")DATA.weaponParts=state.weaponParts;}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function prettyName(s){return String(s==null?'':s).replace(//g,' Plus').replace(/\s+/g,' ').trim();}
function partFlavor(p){if(!p) return ''; if(p.text) return p.text; try{ const k=(p.class||'')+'|'+(p.slot||'')+'|'+prettyName(p.name_en||p.name||''); if(typeof PART_EFFECTS!=='undefined' && PART_EFFECTS[k]) return PART_EFFECTS[k]; }catch(e){}; return ''; }
const overlay=document.createElement('div');
overlay.id='forgeOverlay';
overlay.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:10005;display:none;background:var(--board);color:var(--text);font-family:inherit;overflow:hidden;';
overlay.innerHTML=
  '<div style="padding:10px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);display:flex;align-items:center;justify-content:flex-start;position:relative;">'+
    '<h1 style="margin:0;font-size:18px;">Forge</h1>'+
    '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:6px;">'+
      '<button id="forgeTopAddAll" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 10px;cursor:pointer;font-weight:600;font-size:12px;">Add all upgraded (selected act)</button>'+
      '<button id="forgeTopManage" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 10px;cursor:pointer;font-size:12px;">Manage Starting Inventory</button>'+
      '<button id="forgeTopClear" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 10px;cursor:pointer;font-size:12px;">Clear all</button>'+
    '</div>'+
  '</div>'+
  '<div style="display:flex;gap:8px;padding:8px 18px;background:var(--panel2);border-bottom:1px solid var(--edge);justify-content:center;">'+
    '<button data-forgecat="armor" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Armor</button>'+
    '<button data-forgecat="trinkets" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Trinkets</button>'+
    '<button data-forgecat="weaponinv" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Weapons</button>'+
    '<button data-forgecat="weapons" style="padding:6px 12px;border:1px solid var(--edge);background:var(--torch);color:var(--ink);border-radius:4px;cursor:pointer;font-weight:600;">Loadout</button>'+
    '<button data-forgecat="itempool" style="padding:6px 12px;border:1px solid var(--edge);background:var(--panel);color:var(--text);border-radius:4px;cursor:pointer;">Item Pool</button>'+
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
function isDefaultPart(cls,slot,id){ id=String(id||''); if(slot==='A') return /_1$/i.test(id) && id.indexOf(cls)!==-1? true : /_1$/i.test(id); if(slot==='B'||slot==='C') return /_0$/i.test(id); return false; }
function carouselItems(cls,slot){return partVariants(cls,slot).filter(function(w){return inStartInv(w.id) || isDefaultPart(cls,slot,w.id);});}
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
  '<label style="display:block;font-size:12px;color:var(--dim);margin-top:10px;">Flavor text</label><textarea id="wText" style="width:100%;min-height:48px;padding:6px 8px;border:1px solid var(--edge);background:var(--panel2);color:var(--text);border-radius:4px;box-sizing:border-box;">'+esc(p.text || partFlavor(p))+'</textarea>'+
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
  const arr=carouselItems(cls,slot);
  if(!arr.length) return '<div style="color:var(--dim);font-size:12px;text-align:center;padding:8px 0;">none</div>';
  let idx=carIdx[carKey(cls,slot)];
  if(idx==null || idx<0 || idx>=arr.length){
    const def=arr.find(function(w){return isDefaultPart(cls,slot,w.id);});
    const withFlavor=arr.filter(function(w){return partFlavor(w);});
    if (def) idx=arr.indexOf(def);
    else if (withFlavor.length) idx=arr.indexOf(withFlavor[0]);
    else idx=0;
  }
  const p=arr[idx];
  const name=prettyName(p.name_en||p.name||p.id);
  const flavor=prettyName(partFlavor(p));
  const imgBaseId = String(p.id||'').replace(/_UPGRADED$/i,'').replace(/_PLUS$/i,'');
  const imgTag = showImage ? '<img src="../img/weapon/'+imgBaseId+'.png" style="width:100%;max-width:180px;aspect-ratio:1/1;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:6px;margin-bottom:6px;" onerror="this.style.display=&quot;none&quot;;">' : '';
  return '<div style="border:1px solid var(--edge);background:var(--panel);border-radius:6px;padding:8px;width:100%;max-width:240px;">'+
    '<div style="font-size:11px;color:var(--dim);margin-bottom:4px;">'+slot+' part ('+(idx+1)+'/'+arr.length+')</div>'+
    (imgTag? (imgTag+'<div style="margin-bottom:4px;"></div>') : '')+
    '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:6px;">'+
      (arr.length>1 ? '<button data-step="'+cls+'|'+slot+'|-1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&lt;</button>' : '')+
      '<div style="flex:1;text-align:center;font-size:13px;word-break:break-word;">'+esc(name)+'</div>'+
      (arr.length>1 ? '<button data-step="'+cls+'|'+slot+'|1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&gt;</button>' : '')+
    '</div>'+
    (flavor ? '<div style="color:var(--dim);font-size:11px;text-align:center;margin-bottom:6px;line-height:1.3;">'+esc(flavor)+'</div>' : '')+
    '<div style="margin-top:6px;text-align:center;"><button data-editpart="'+p.id+'" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">Edit</button></div>'+
  '</div>';
}
function currentCarouselPart(cls,slot){
  const arr=carouselItems(cls,slot);
  if(!arr.length) return null;
  let idx=carIdx[carKey(cls,slot)];
  if(idx==null || idx<0 || idx>=arr.length){
    const def=arr.find(function(w){return isDefaultPart(cls,slot,w.id);});
    const wf=arr.filter(function(w){return partFlavor(w);});
    if(def) idx=arr.indexOf(def);
    else if(wf.length) idx=arr.indexOf(wf[0]);
    else idx=0;
  }
  return arr[idx]||null;
}
function makeHeroLoadout(cls){
  try{
    if(typeof ensureCampLoadout!=='function'){ alert('Loadout editor not available.'); return; }
    const classes=(typeof HERO_DEFAULT_LOADOUT_CLASSES!=='undefined')? (HERO_DEFAULT_LOADOUT_CLASSES[selectedHero]||[]) : [];
    const slotIndex=classes.indexOf(cls);
    if(slotIndex<0){ alert('This weapon is not one of the selected hero default slots.'); return; }
    const a=currentCarouselPart(cls,'A');
    const b=currentCarouselPart(cls,'B');
    const c=currentCarouselPart(cls,'C');
    const L=ensureCampLoadout(selectedHero);
    L.slots[slotIndex].a=a? a.id : '';
    L.slots[slotIndex].b=b? b.id : '';
    L.slots[slotIndex].c=c? c.id : '';
    if(typeof syncLoadoutToStartItems==='function') syncLoadoutToStartItems();
    if(typeof renderRight==='function') renderRight();
    renderHeroWeapons();
    alert('Loadout updated for '+selectedHero+' slot '+(slotIndex+1)+'.');
  } catch(e){ console.error('MAKE_LOADOUT_ERR', e && (e.stack||e)); alert('Failed: '+(e&&e.message||e)); }
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
      '<div style="margin-top:6px;text-align:center;"><button data-makeloadout="'+cls+'" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;font-weight:600;">click to make hero\'s loadout</button></div>'+
    '</div>'}).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;justify-content:center;position:static;background:var(--panel2);padding:8px 0;">'+
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
  main.querySelectorAll('[data-makeloadout]').forEach(function(b){
    b.addEventListener('click',function(){ makeHeroLoadout(b.getAttribute('data-makeloadout')); });
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
    const img = imgFolder ? '<img src="../img/'+imgFolder+'/'+x.id+'.png" style="width:48px;height:48px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">' : '';
    return '<div style="padding:8px;margin-bottom:6px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">'+
      '<div style="display:flex;align-items:center;gap:8px;">'+img+'<span>'+esc(name)+'</span></div>'+
      '<span style="font-size:11px;color:'+(isIn?'var(--verd)':'var(--dim)')+';">'+(isIn?'In Starting Inventory':'Not in Starting Inventory')+'</span>'+
    '</div>';
  }).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;position:static;background:var(--panel2);padding:8px 0;">'+
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
function forgeAllowedAct2(){ try { return !!(typeof camp!=="undefined" && camp && camp.meta && (camp.meta.act!=="I" || !!camp.meta.requiresAct2)); } catch(e){ return false; } }
function clearAllStartInv(){ try { camp.start=camp.start||{items:[]}; camp.start.items=[]; } catch(e){} if(typeof renderRight==='function') renderRight(); renderActiveCategory(); }
function renderArmorCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const gear=((typeof DATA!=='undefined' && Array.isArray(DATA.gear))? DATA.gear.filter(function(g){return g.kind==='armor';}) : []);
  const families=[];
  const seen=new Set();
  gear.forEach(function(g){
    const m=String(g.id||'').match(/^ARMOR_[0-9]+/i);
    if(m && !seen.has(m[0])){ seen.add(m[0]); families.push(m[0].toUpperCase()); }
  });
  families.sort(function(a,b){ return a.localeCompare(b, undefined, {numeric:true}); });
  const familyRows=families.map(function(fam){
    const baseId=fam;
    const plusId=fam+'_PLUS';
    const g=gear.find(function(x){return x.id===baseId;}) || gear.find(function(x){return x.id===plusId;});
    const name=prettyName((typeof L==='function' && g)? L(g,'name') : (g && (g.name_en||g.name) || fam));
    const baseOwned=inStartInv(baseId);
    const plusOwned=inStartInv(plusId);
    const act=(typeof itemActOf==='function')? itemActOf({id:baseId}) : 1;
    const baseData=gear.find(function(x){return x.id===baseId;});
    const img = baseData ? '<img src="../img/armor/'+baseId+'.png" style="width:64px;height:64px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">' : '';
    return {act: act, html: '<div style="padding:8px;margin-bottom:6px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
      img+
      '<div style="flex:1;min-width:140px;">'+esc(name)+(act>=2?' (Act II)':'')+'</div>'+
      '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;'+(plusOwned?'opacity:.45;':'')+'"><input type="checkbox" data-startid="'+baseId+'" '+(baseOwned?'checked':'')+(plusOwned?' disabled':'')+'> Base</label>'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" data-startid="'+plusId+'" '+(plusOwned?'checked':'')+'> Upgraded</label>'+
      '</div>'+
    '</div>'};
  });
  const act1Rows=familyRows.filter(function(r){return r.act<2;}).map(function(r){return r.html;}).join('');
  const act2Rows=familyRows.filter(function(r){return r.act>=2;}).map(function(r){return r.html;}).join('');
  const allowedAct2=forgeAllowedAct2();
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;position:static;background:var(--panel2);padding:8px 0;">'+
      '<button id="forgeAddAllBase" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Add all base</button>'+
      '<button id="forgeAddAllUpgraded" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded</button>'+
      '<button id="forgeClearPage" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Clear</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,max-content));gap:12px;align-items:start;justify-items:center;margin:0 auto;width:fit-content;">'+
      '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Armor - Act I</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' + (act1Rows||'<p style="color:var(--dim);">No items found.</p>') + '</div></div>'+
      (allowedAct2 ? '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Armor - Act II</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' + (act2Rows||'<p style="color:var(--dim);">No items found.</p>') + '</div></div>' : '')+
    '</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  main.querySelectorAll('input[data-startid]').forEach(function(cb){
    cb.addEventListener('change', function(){ var id=cb.getAttribute('data-startid'); if(cb.checked && /_PLUS$/i.test(id)){ setStartInv(id.replace(/_PLUS$/i,''), false); } setStartInv(id, cb.checked); renderArmorCategory(); });
  });
  const addBaseBtn=main.querySelector('#forgeAddAllBase');
  if(addBaseBtn) addBaseBtn.addEventListener('click',function(){ families.forEach(function(fam){ const act=(typeof itemActOf==='function')? itemActOf({id:fam}) : 1; if(act>=2 && !allowedAct2) return; setStartInv(fam, true); }); renderArmorCategory(); });
  const addUpgradedBtn=main.querySelector('#forgeAddAllUpgraded');
  if(addUpgradedBtn) addUpgradedBtn.addEventListener('click',function(){ families.forEach(function(fam){ const act=(typeof itemActOf==='function')? itemActOf({id:fam}) : 1; if(act>=2 && !allowedAct2) return; setStartInv(fam+'_PLUS', true); }); renderArmorCategory(); });
  const clearBtn=main.querySelector('#forgeClearPage');
  if(clearBtn) clearBtn.addEventListener('click',function(){ main.querySelectorAll('input[data-startid]').forEach(function(cb){ setStartInv(cb.getAttribute('data-startid'), false); }); renderArmorCategory(); });
}
function renderTrinketsCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const gear=((typeof DATA!=='undefined' && Array.isArray(DATA.gear))? DATA.gear.filter(function(g){return g.kind==='trinket';}) : []);
  const families=[];
  const seen=new Set();
  gear.forEach(function(g){
    const m=String(g.id||'').match(/^TRINKET[0-9]+_ID/i);
    if(m && !seen.has(m[0])){ seen.add(m[0]); families.push(m[0].toUpperCase()); }
  });
  families.sort(function(a,b){ return a.localeCompare(b, undefined, {numeric:true}); });
  const familyRows=families.map(function(fam){
    const baseId=fam;
    const plusId=fam+'_PLUS';
    const g=gear.find(function(x){return x.id===baseId;}) || gear.find(function(x){return x.id===plusId;});
    const name=prettyName((typeof L==='function' && g)? L(g,'name') : (g && (g.name_en||g.name) || fam));
    const baseOwned=inStartInv(baseId);
    const plusOwned=inStartInv(plusId);
    const act=(typeof itemActOf==='function')? itemActOf({id:baseId}) : 1;
    const baseData=gear.find(function(x){return x.id===baseId;});
    const img = baseData ? '<img src="../img/trinket/'+baseId+'.png" style="width:64px;height:64px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">' : '';
    return {act: act, html: '<div style="padding:8px;margin-bottom:6px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
      img+
      '<div style="flex:1;min-width:140px;">'+esc(name)+(act>=2?' (Act II)':'')+'</div>'+
      '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;'+(plusOwned?'opacity:.45;':'')+'"><input type="checkbox" data-startid="'+baseId+'" '+(baseOwned?'checked':'')+(plusOwned?' disabled':'')+'> Base</label>'+
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" data-startid="'+plusId+'" '+(plusOwned?'checked':'')+'> Upgraded</label>'+
      '</div>'+
    '</div>'};
  });
  const act1Rows=familyRows.filter(function(r){return r.act<2;}).map(function(r){return r.html;}).join('');
  const act2Rows=familyRows.filter(function(r){return r.act>=2;}).map(function(r){return r.html;}).join('');
  const allowedAct2=forgeAllowedAct2();
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;position:static;background:var(--panel2);padding:8px 0;">'+
      '<button id="forgeAddAllBase" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Add all base</button>'+
      '<button id="forgeAddAllUpgraded" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded</button>'+
      '<button id="forgeClearPage" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Clear</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,max-content));gap:12px;align-items:start;justify-items:center;margin:0 auto;width:fit-content;">'+
      '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Trinkets - Act I</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' + (act1Rows||'<p style="color:var(--dim);">No items found.</p>') + '</div></div>'+
      (allowedAct2 ? '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Trinkets - Act II</h2><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' + (act2Rows||'<p style="color:var(--dim);">No items found.</p>') + '</div></div>' : '')+
    '</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  main.querySelectorAll('input[data-startid]').forEach(function(cb){
    cb.addEventListener('change', function(){ var id=cb.getAttribute('data-startid'); if(cb.checked && /_PLUS$/i.test(id)){ setStartInv(id.replace(/_PLUS$/i,''), false); } setStartInv(id, cb.checked); renderTrinketsCategory(); });
  });
  const addBaseBtn=main.querySelector('#forgeAddAllBase');
  if(addBaseBtn) addBaseBtn.addEventListener('click',function(){ families.forEach(function(fam){ const act=(typeof itemActOf==='function')? itemActOf({id:fam}) : 1; if(act>=2 && !allowedAct2) return; setStartInv(fam, true); }); renderTrinketsCategory(); });
  const addUpgradedBtn=main.querySelector('#forgeAddAllUpgraded');
  if(addUpgradedBtn) addUpgradedBtn.addEventListener('click',function(){ families.forEach(function(fam){ const act=(typeof itemActOf==='function')? itemActOf({id:fam}) : 1; if(act>=2 && !allowedAct2) return; setStartInv(fam+'_PLUS', true); }); renderTrinketsCategory(); });
  const clearBtn=main.querySelector('#forgeClearPage');
  if(clearBtn) clearBtn.addEventListener('click',function(){ main.querySelectorAll('input[data-startid]').forEach(function(cb){ setStartInv(cb.getAttribute('data-startid'), false); }); renderTrinketsCategory(); });
}

function renderEnemiesCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const items=((typeof DATA!=='undefined' && Array.isArray(DATA.enemies))? DATA.enemies : []);
  const allowedAct2=(typeof camp!=='undefined' && camp.meta && (camp.meta.act!=='I' || !!camp.meta.requiresAct2)) || false;
  const filtered=items.filter(function(x){ const act=(typeof itemActOf==='function')? itemActOf(x): (x.act||1); return !(act>=2 && !allowedAct2); });
  const act1=filtered.filter(function(x){ return ((typeof itemActOf==='function')? itemActOf(x) : (x.act||1)) < 2; });
  const act2=filtered.filter(function(x){ return ((typeof itemActOf==='function')? itemActOf(x) : (x.act||1)) >= 2; });
  function row(x){
    const act=(typeof itemActOf==='function')? itemActOf(x) : (x.act||1);
    const img='<img src="../img/enemy/'+x.id+'.png" style="width:48px;height:48px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">';
    return '<div style="padding:6px;margin-bottom:4px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:8px;">'+
      img+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-size:12px;">'+esc(x.name_en||x.name||x.id)+(act>=2?' (Act II)':'')+'</div>'+
        '<div style="color:var(--dim);font-size:11px;">'+esc(x.id)+'</div>'+
        '<div style="color:var(--dim);font-size:11px;">HP '+esc(x.hp)+' | DEF '+esc(x.def)+' | ATK '+esc(x.atk)+'</div>'+
      '</div>'+
    '</div>';
  }
  const r1=act1.map(row).join('');
  const r2=act2.map(row).join('');
  main.innerHTML=
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-items:start;justify-items:center;margin:0 auto;width:fit-content;">'+
      '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Enemies - Act I</h2><div>'+(r1||'<p style="color:var(--dim);">No items found.</p>')+'</div></div>'+
      (allowedAct2 ? '<div><h2 style="margin:0 0 8px 0;font-size:16px;">Enemies - Act II</h2><div>'+(r2||'<p style="color:var(--dim);">No items found.</p>')+'</div></div>' : '')+
    '</div>';
}
function sharedVariants(slot,rune){
  const keyHint=rune.toUpperCase();
  return partVariants('Rune',slot).filter(function(w){ return String(w.id||'').toUpperCase().indexOf(keyHint)>=0; });
}
function sharedCol(rune){
  const aArr=sharedVariants('A',rune).filter(function(w){ return inStartInv(w.id) || isDefaultPart('Rune','A',w.id); });
  const cArr=sharedVariants('C',rune).filter(function(w){ return inStartInv(w.id) || isDefaultPart('Rune','C',w.id); });
  const bId = 'WEAPON_PART_B_'+rune;
  const bPart = state.weaponParts.find(function(w){ return w.id===bId; });
  const aKey = 'shared|Rune|A|'+rune;
  const cKey = 'shared|Rune|C|'+rune;
  let aIdx = carIdx[aKey];
  if(aIdx==null || aIdx<0 || aIdx>=aArr.length){ const def=aArr.find(function(w){return isDefaultPart('Rune','A',w.id);}); const wf=aArr.filter(function(w){return partFlavor(w);}); if(def) aIdx=aArr.indexOf(def); else if(wf.length) aIdx=aArr.indexOf(wf[0]); else aIdx=0; }
  let cIdx = carIdx[cKey];
  if(cIdx==null || cIdx<0 || cIdx>=cArr.length){ const def=cArr.find(function(w){return isDefaultPart('Rune','C',w.id);}); const wf=cArr.filter(function(w){return partFlavor(w);}); if(def) cIdx=cArr.indexOf(def); else if(wf.length) cIdx=cArr.indexOf(wf[0]); else cIdx=0; }
  const aCur = aArr.length ? aArr[aIdx] : null;
  const cCur = cArr.length ? cArr[cIdx] : null;
  const car = function(cls,slot,arr,idx,key,showImg){
    if(!arr.length) return '<div style="color:var(--dim);font-size:12px;text-align:center;padding:8px 0;">none</div>';
    const p=arr[idx];
    const name=prettyName(p.name_en||p.name||p.id);
    const imgTag = showImg ? '<img src="../img/weapon/'+String(p.id).replace(/_UPGRADED$/i,'').replace(/_PLUS$/i,'')+'.png" style="width:100%;max-width:180px;aspect-ratio:1/1;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:6px;margin-bottom:6px;" onerror="this.style.display=&quot;none&quot;;">' : '';
    const flavor=prettyName(partFlavor(p));
    return '<div style="border:1px solid var(--edge);background:var(--panel);border-radius:6px;padding:8px;width:100%;max-width:240px;">'+
      '<div style="font-size:11px;color:var(--dim);margin-bottom:4px;">'+slot+' part ('+(idx+1)+'/'+arr.length+')</div>'+
      (imgTag? (imgTag+'<div style="margin-bottom:4px;"></div>') : '')+
      '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:6px;">'+
        (arr.length>1? '<button data-sharedstep="'+key+'|-1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&lt;</button>' : '')+
        '<div style="flex:1;text-align:center;font-size:13px;word-break:break-word;">'+esc(name)+'</div>'+
        (arr.length>1? '<button data-sharedstep="'+key+'|1" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;cursor:pointer;padding:2px 8px;">&gt;</button>' : '')+
      '</div>'+
      (flavor ? '<div style="color:var(--dim);font-size:11px;text-align:center;margin-bottom:6px;line-height:1.3;">'+esc(flavor)+'</div>' : '')+
      '<div style="margin-top:6px;text-align:center;"><button data-editpart="'+p.id+'" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;">Edit</button></div>'+
    '</div>';
  };
  const ownedShared = sharedVariants('A',rune).some(function(w){return inStartInv(w.id);}) || inStartInv('WEAPON_PART_B_'+rune) || sharedVariants('C',rune).some(function(w){return inStartInv(w.id);});
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;border:1px solid var(--edge);background:var(--panel2);border-radius:8px;opacity:'+(ownedShared?'1':'.45')+';filter:'+(ownedShared?'none':'grayscale(1)')+';">'+
    '<div style="font-weight:600;margin-bottom:6px;">'+rune.replace(/_/g,' ')+(/DRAGONSBANE|FEAR|SUNBURST/i.test(rune)?' (Act II)':'')+'</div>'+
    '<div style="font-size:11px;color:'+( (sharedVariants('A',rune).some(function(w){return inStartInv(w.id);}) || inStartInv('WEAPON_PART_B_'+rune) || sharedVariants('C',rune).some(function(w){return inStartInv(w.id);}) ) ? 'var(--verd)' : 'var(--dim)' )+';margin-bottom:6px;">'+( (sharedVariants('A',rune).some(function(w){return inStartInv(w.id);}) || inStartInv('WEAPON_PART_B_'+rune) || sharedVariants('C',rune).some(function(w){return inStartInv(w.id);}) ) ? 'In Starting Inventory' : 'Not in Starting Inventory' )+'</div>'+
    car('Rune','A',aArr,aIdx,aKey,true)+
    (!ownedShared ? '<div style="text-align:center;margin-top:6px;"><button data-addshared="'+rune+'" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 10px;cursor:pointer;font-weight:600;font-size:12px;">Add to Starting Inventory</button></div>' : '')+
  '</div>';
}
function addSharedToStart(rune){
  const aVars=sharedVariants('A',rune);
  const aPick=aVars.find(function(w){return /_UPGRADED$/i.test(w.id);}) || aVars.find(function(w){return isDefaultPart('Rune','A',w.id);}) || aVars[0];
  if(aPick) setStartInv(aPick.id,true);
  setStartInv('WEAPON_PART_B_'+rune,true);
  const cVars=sharedVariants('C',rune);
  const cPick=cVars.find(function(w){return !/_UPGRADED$/i.test(w.id);}) || cVars[0];
  if(cPick) setStartInv(cPick.id,true);
  if(typeof renderRight==='function') renderRight();
  renderSharedCategory();
}
function renderSharedCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const runes=['DRAGONSBANE','FEAR','ICE_STORM','LIGHTNING_STRIKE','RUNE_OF_BLADES','SUNBURST'];
  const act1Runes=runes.filter(function(r){return !/DRAGONSBANE|FEAR|SUNBURST/i.test(r);});
  const act2Runes=runes.filter(function(r){return /DRAGONSBANE|FEAR|SUNBURST/i.test(r);});
  const act1Cols=act1Runes.map(function(rune){return sharedCol(rune);}).join('');
  const act2Cols=act2Runes.map(function(rune){return sharedCol(rune);}).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;position:static;background:var(--panel2);padding:8px 0;">'+
      '<button id="forgeAddAllAct" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded for selected Acts</button>'+
      '<button id="forgeManageStart" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Manage Starting Inventory</button>'+
    '</div>'+
    '<h2 style="margin:0 0 8px 0;font-size:16px;">Shared Weapons - Act I</h2>'+
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-content:start;margin-bottom:10px;">'+act1Cols+'</div>'+
    '<h2 style="margin:0 0 8px 0;font-size:16px;">Shared Weapons - Act II</h2>'+
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-content:start;">'+act2Cols+'</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  main.querySelectorAll('[data-sharedstep]').forEach(function(b){
    b.addEventListener('click',function(){
      const parts=b.getAttribute('data-sharedstep').split('|');
      const rune=parts[0], slot=parts[1], dir=parseInt(parts[parts.length-1],10);
      const key='shared|Rune|'+slot+'|'+rune;
      const arr=sharedVariants(slot,rune).filter(function(w){ return inStartInv(w.id) || isDefaultPart('Rune',slot,w.id); });
      if(!arr.length) return;
      let idx=carIdx[key]||0;
      idx=(idx+dir+arr.length)%arr.length;
      carIdx[key]=idx;
      renderSharedCategory();
    });
  });
  main.querySelectorAll('[data-editpart]').forEach(function(b){
    b.addEventListener('click',function(){ selected=b.getAttribute('data-editpart'); renderEditorTarget(); });
  });
  main.querySelectorAll('[data-addshared]').forEach(function(b){
    b.addEventListener('click',function(){ addSharedToStart(b.getAttribute('data-addshared')); });
  });
  const addBtn=main.querySelector('#forgeAddAllAct');
  if(addBtn) addBtn.addEventListener('click',function(){ if(typeof addAllUpgradedGlobal==='function') addAllUpgradedGlobal(); renderSharedCategory(); });
  const manageBtn=main.querySelector('#forgeManageStart');
  if(manageBtn) manageBtn.addEventListener('click',function(){ if(typeof abrirInicioPopup==='function') abrirInicioPopup(); });
}

function renderItemPoolCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  const invIds = (typeof camp!=='undefined' && camp.start && Array.isArray(camp.start.items)) ? camp.start.items.map(function(i){return i.id;}) : [];
  const invFamilies = new Set(invIds.map(function(id){ return (typeof itemFamilyId==='function') ? itemFamilyId(id) : String(id||'').replace(/^RECIPE_/i,'').replace(/_PLUS$|_UPGRADED$/i,''); }));
  let allItems = [];
  if(typeof GRUPOS_INICIO==='function'){
    GRUPOS_INICIO().filter(function(g){return g && g[0]!=='loot';}).forEach(function(g){
      (g[1]||[]).forEach(function(x){ allItems.push(x); });
    });
  }
  const allowedAct2 = (typeof camp!=='undefined' && camp.meta && (camp.meta.act!=='I' || !!camp.meta.requiresAct2)) || false;
  allItems = allItems.filter(function(x){ return !camp || allowedAct2 || ( (typeof itemActOf==='function')? itemActOf(x) : 1 ) < 2; });
  const avail = allItems.filter(function(x, idx){
    const fam = (typeof itemFamilyId==='function') ? itemFamilyId(x.id) : String(x.id||'').replace(/^RECIPE_/i,'').replace(/_PLUS$|_UPGRADED$/i,'');
    return allItems.indexOf(x)===idx && invIds.indexOf(x.id)===-1 && /^RECIPE_/i.test(String(x.id||'')) && !invFamilies.has(fam);
  });
  function imageFor(id){
    id=String(id||''); let base=id.replace(/^RECIPE_/i,'').replace(/_UPGRADED$|_PLUS$/i,'');
    let folder=null;
    if(/ARMOR/.test(id)) folder='armor';
    else if(/TRINKET/.test(id)) folder='trinket';
    else if(/WEAPON_PART/.test(id)) folder='weapon';
    else if(/CSM/.test(id) || /MAT_/.test(id)) folder='csm';
    if(!folder) return '';
    return '<img src="../img/'+folder+'/'+base+'.png" style="width:64px;height:64px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">';
  }
  function groupOf(x){
    const id=String(x.id||'').toUpperCase();
    if(/ARMOR/.test(id)) return 'Armor';
    if(/TRINKET/.test(id)) return 'Trinkets';
    if(/WEAPON_PART/.test(id)) return 'Weapons';
    if(/CSM/.test(id)) return 'Consumables';
    if(/MAT_/.test(id)) return 'Materials';
    return 'Other';
  }
  const groupOrder=['Armor','Weapons','Trinkets','Consumables','Materials','Other'];
  const grouped={};
  avail.forEach(function(x){ const g=groupOf(x); if(!grouped[g]) grouped[g]=[]; grouped[g].push(x); });
  const sections=groupOrder.map(function(gn){
    const items=grouped[gn]; if(!items || !items.length) return '';
    if(gn!=='Weapons'){
      const cells=items.map(function(x){
        const name=prettyName((typeof L==='function')? L(x,'name') : (x.name_en||x.name||x.id));
        const img=imageFor(x.id);
        return '<div style="padding:8px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:10px;font-size:12px;line-height:1.2;">'+img+'<span style="word-break:break-all;">'+esc(name)+'</span></div>';
      }).join('');
      return '<div style="margin-bottom:8px;"><h3 style="margin:0 0 6px 0;font-size:15px;color:var(--text);font-weight:700;">'+esc(gn)+' ('+items.length+')</h3><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;">'+cells+'</div></div>';
    }
    // group weapons by hero
    const heroGroups={};
    items.forEach(function(x){
      let hero='Common';
      const base=String(x.id||'').replace(/^RECIPE_/i,'').replace(/_UPGRADED$|_PLUS$/i,'');
      const w=(typeof DATA!=='undefined' && Array.isArray(DATA.weaponParts))? (DATA.weaponParts.find(function(p){return p.id===base;}) || DATA.weaponParts.find(function(p){return base.indexOf(p.id)===0;})) : null;
      if(w && typeof HERO_FOR_CLASS!=='undefined'){ hero=HERO_FOR_CLASS[w.class] || hero; }
      const label=(typeof HERO_LABELS!=='undefined' && hero!=='Common')? (HERO_LABELS[hero]||hero) : hero;
      if(!heroGroups[label]) heroGroups[label]=[];
      heroGroups[label].push(x);
    });
    const heroNames=Object.keys(heroGroups).sort();
    const blocks=heroNames.map(function(label){
      const its=heroGroups[label];
      const cells=its.map(function(x){
        const name=prettyName((typeof L==='function')? L(x,'name') : (x.name_en||x.name||x.id));
        const img=imageFor(x.id);
        return '<div style="padding:8px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:10px;font-size:12px;line-height:1.2;">'+img+'<span style="word-break:break-all;">'+esc(name)+'</span></div>';
      }).join('');
      return '<div style="margin-bottom:6px;"><h4 style="margin:0 0 4px 0;font-size:13px;color:var(--text);font-weight:700;">'+esc(label)+' ('+its.length+')</h4><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;">'+cells+'</div></div>';
    }).join('');
    return '<div style="margin-bottom:8px;"><h3 style="margin:0 0 6px 0;font-size:15px;color:var(--text);font-weight:700;">Weapons ('+items.length+')</h3>'+blocks+'</div>';
  }).join('');
  main.innerHTML=
    '<div style="color:var(--dim);font-size:12px;margin-bottom:8px;text-align:center;">Available recipes and items not in Starting Inventory.</div>' +
    (avail.length ? '' : '<p style="color:var(--dim);text-align:center;margin-top:20px;">No available items.</p>') +
    sections;
}
function renderWeaponInventoryCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  if(typeof selectedHero==='undefined' || !selectedHero) selectedHero=(typeof HERO_LABELS!=='undefined'? (Object.keys(HERO_LABELS)[0]||'HERO_BRYNN') : 'HERO_BRYNN');
  const heroes=(typeof HERO_ORDER!=='undefined')? HERO_ORDER : Object.keys((typeof HERO_LABELS!=='undefined')? HERO_LABELS : {'HERO_BRYNN':'Brynn'});
  const classes=(typeof HERO_DEFAULT_LOADOUT_CLASSES!=='undefined')? (HERO_DEFAULT_LOADOUT_CLASSES[selectedHero]||[]) : [];
  const left=heroes.map(function(h){
    const on=h===selectedHero;
    return '<button data-hero="'+h+'" style="padding:10px 6px;background:'+(on?'var(--torch)':'var(--panel2)')+';color:'+(on?'var(--ink)':'var(--text)')+';border:1px solid var(--edge);border-radius:6px;cursor:pointer;font-weight:'+(on?'700':'400')+';">'+esc((typeof HERO_LABELS!=='undefined')? (HERO_LABELS[h]||h) : h)+'</button>';
  }).join('');
  function groupRows(cls, slotLetter){
    const allowedAct2=forgeAllowedAct2();
    const parts=((typeof DATA!=='undefined' && Array.isArray(DATA.weaponParts))? DATA.weaponParts : []).filter(function(w){
      if((slotLetter==='B' || slotLetter==='C') && /_0$/i.test(String(w.id||''))) return false;
      if((typeof itemActOf==='function') && itemActOf({id:w.id})>=2 && !allowedAct2) return false;
      return w.class===cls && w.slot===slotLetter;
    });
    const seen=new Set();
    const families=[];
    parts.forEach(function(w){ const base=String(w.id||'').replace(/_UPGRADED$/i,''); if(!seen.has(base)){ seen.add(base); families.push(base); } });
    families.sort(function(a,b){ return String(a).localeCompare(String(b)); });
    return families.map(function(baseId){
      const plusId=baseId+'_UPGRADED';
      const basePart=parts.find(function(x){return x.id===baseId;});
      const plusPart=parts.find(function(x){return x.id===plusId;});
      const g=basePart || plusPart;
      const baseOwned=inStartInv(baseId);
      const plusOwned=inStartInv(plusId);
      const img='<img src="../img/weapon/'+String(baseId).replace(/_UPGRADED$|_PLUS$/i,'')+'.png" style="width:40px;height:40px;object-fit:contain;background:var(--ink);border:1px solid var(--edge);border-radius:4px;margin-right:8px;" onerror="this.style.display=&quot;none&quot;;">';
      const wname=prettyName((g && (g.name_en||g.name)) || baseId);
      const flavor=partFlavor(g||{});
      const partAct=(typeof itemActOf==='function')? itemActOf({id:baseId}) : 1;
      return '<div style="padding:6px;margin-bottom:4px;border:1px solid var(--edge);background:var(--panel2);border-radius:6px;display:flex;align-items:center;gap:8px;">'+
        img+
        '<div style="flex:1;font-size:12px;word-break:break-all;">'+esc(wname)+(partAct>=2?' (Act II)':'')+(flavor && flavor!==wname? '<div style="color:var(--dim);font-size:11px;">'+esc(flavor)+'</div>':'')+'<div style="color:var(--dim);font-size:11px;">'+esc(baseId)+'</div></div>'+
        '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">'+
          (basePart? '<label style="display:flex;align-items:center;gap:4px;font-size:12px;'+(plusOwned?'opacity:.45;':'')+'"><input type="checkbox" data-startid="'+baseId+'" '+(baseOwned?'checked':'')+(plusOwned?' disabled':'')+'> Base</label>' : '')+
          (plusPart? '<label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" data-startid="'+plusId+'" '+(plusOwned?'checked':'')+'> Upgraded</label>' : '')+
        '</div>'+
      '</div>';
    }).join('');
  }
  const slotsHtml=classes.map(function(cls, i){
    const aRows=groupRows(cls,'A');
    const bRows=groupRows(cls,'B');
    const cRows=groupRows(cls,'C');
    return '<div style="border:1px solid var(--edge);border-radius:8px;padding:8px;margin-bottom:10px;background:var(--panel);">'+
      '<div style="font-weight:600;margin-bottom:8px;">Slot '+(i+1)+' - '+esc(cls)+'</div>'+
      '<div style="margin-bottom:6px;font-size:12px;color:var(--dim);">Part A</div>'+ (aRows||'<p style="color:var(--dim);font-size:12px;">No items</p>')+
      '<div style="margin:8px 0 6px 0;font-size:12px;color:var(--dim);">Part B</div>'+ (bRows||'<p style="color:var(--dim);font-size:12px;">No items</p>')+
      '<div style="margin:8px 0 6px 0;font-size:12px;color:var(--dim);">Part C</div>'+ (cRows||'<p style="color:var(--dim);font-size:12px;">No items</p>')+
    '</div>';
  }).join('');
  main.innerHTML=
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;position:static;background:var(--panel2);padding:8px 0;">'+
      '<button id="forgeInvAddBase" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Add all base</button>'+
      '<button id="forgeInvAddUpgraded" style="background:var(--torch);color:var(--ink);border:0;border-radius:4px;padding:6px 12px;cursor:pointer;font-weight:600;">Add all upgraded</button>'+
      '<button id="forgeInvClear" style="background:var(--panel2);color:var(--text);border:1px solid var(--edge);border-radius:4px;padding:6px 12px;cursor:pointer;">Clear</button>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:130px 1fr;gap:12px;height:100%;">'+
      '<div style="display:flex;flex-direction:column;gap:8px;">'+left+'</div>'+
      '<div style="min-width:0;"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">'+slotsHtml+'</div></div>'+
    '</div>'+
    '<div id="forgeEditor" style="margin-top:12px;"></div>';
  main.querySelectorAll('button[data-hero]').forEach(function(b){ b.addEventListener('click', function(){ selectedHero=b.getAttribute('data-hero'); renderWeaponInventoryCategory(); }); });
  main.querySelectorAll('input[data-startid]').forEach(function(cb){ cb.addEventListener('change', function(){ var id=cb.getAttribute('data-startid'); if(cb.checked && /_UPGRADED$/i.test(id)){ setStartInv(id.replace(/_UPGRADED$/i,''), false); } setStartInv(id, cb.checked); renderWeaponInventoryCategory(); }); });
  const addBaseBtn=main.querySelector('#forgeInvAddBase');
  if(addBaseBtn) addBaseBtn.addEventListener('click',function(){ main.querySelectorAll('input[data-startid]').forEach(function(cb){ if(!/_UPGRADED$/i.test(cb.getAttribute('data-startid'))){ setStartInv(cb.getAttribute('data-startid'), true); } }); renderWeaponInventoryCategory(); });
  const addUpgradedBtn=main.querySelector('#forgeInvAddUpgraded');
  if(addUpgradedBtn) addUpgradedBtn.addEventListener('click',function(){ main.querySelectorAll('input[data-startid]').forEach(function(cb){ if(/_UPGRADED$/i.test(cb.getAttribute('data-startid'))){ setStartInv(cb.getAttribute('data-startid'), true); } }); renderWeaponInventoryCategory(); });
  main.querySelectorAll('[data-makeloadout]').forEach(function(b){ b.addEventListener('click',function(){ makeHeroLoadout(b.getAttribute('data-makeloadout')); }); });
  const clearBtn=main.querySelector('#forgeInvClear');
  if(clearBtn) clearBtn.addEventListener('click', function(){ main.querySelectorAll('input[data-startid]').forEach(function(cb){ setStartInv(cb.getAttribute('data-startid'), false); }); renderWeaponInventoryCategory(); });
}
function renderLoadoutCategory(){
  const main=overlay.querySelector('#forgeMain');
  if(!main) return;
  main.innerHTML='<div id="hlPantallaBody"></div>';
  if(typeof syncLoadoutToStartItems==='function') syncLoadoutToStartItems();
  if(typeof pintarPantallaLoadout==='function') pintarPantallaLoadout();
}
function renderActiveCategory(){ if(activeCat==='weapons') renderLoadoutCategory(); else if(activeCat==='shared') renderSharedCategory(); else if(activeCat==='itempool') renderItemPoolCategory(); else if(activeCat==='armor') renderArmorCategory(); else if(activeCat==='trinkets') renderTrinketsCategory(); else if(activeCat==='weaponinv') renderWeaponInventoryCategory(); else if(activeCat==='enemies') renderEnemiesCategory(); }
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
  } else if(cat==='shared'){
    if(searchWrap) searchWrap.style.display='none';
    if(list) list.style.display='none';
    renderSharedCategory();
  } else if(cat==='itempool'){
    if(searchWrap) searchWrap.style.display='none';
    if(list) list.style.display='none';
    if(editor) editor.innerHTML='';
    renderItemPoolCategory();
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
const topAddAll=overlay.querySelector('#forgeTopAddAll');
if(topAddAll) topAddAll.addEventListener('click',function(){ if(typeof addAllUpgradedGlobal==='function') addAllUpgradedGlobal(); renderActiveCategory(); });
const topManage=overlay.querySelector('#forgeTopManage');
if(topManage) topManage.addEventListener('click',function(){ if(typeof abrirInicioPopup==='function') abrirInicioPopup(); });
const topClear=overlay.querySelector('#forgeTopClear');
if(topClear) topClear.addEventListener('click',function(){ clearAllStartInv(); });

function placeForge(){ var h=document.querySelector('header'); var top=h?(h.getBoundingClientRect().bottom||h.offsetHeight||0):0; overlay.style.top=top+'px'; }
function openForge(){ window.__forgeOpen=true; placeForge(); overlay.style.display='block'; btn.classList.add('on'); renderActiveCategory(); }
function closeForge(){ window.__forgeOpen=false; overlay.style.display='none'; btn.classList.remove('on'); }
try {
  if (typeof addStartItem === 'function') {
    const origAddStartItem = addStartItem;
    window.addStartItem = function(id){ const r = origAddStartItem.apply(this, arguments); setTimeout(function(){ if (window.__forgeOpen && activeCat === 'itempool') renderActiveCategory(); }, 0); return r; };
  }
  if (typeof abrirInicioPopup === 'function') {
    const origAbrirInicioPopup = abrirInicioPopup;
    window.abrirInicioPopup = function(){ const r = origAbrirInicioPopup.apply(this, arguments); setTimeout(function(){
      const done = document.getElementById('iniDone');
      if (done) done.addEventListener('click', function(){ setTimeout(function(){ if (window.__forgeOpen && activeCat === 'itempool') renderActiveCategory(); }, 0); });
      if (window.__forgeOpen && activeCat === 'itempool') renderActiveCategory();
    }, 0); return r; };
  }
} catch (e) { console.warn('forge hooks', e); }

btn.addEventListener('click',function(){ if(overlay.style.display==='block') closeForge(); else openForge(); });
function showForgeContent(){ setCat(activeCat); }
window.addEventListener('resize',function(){ if(overlay.style.display==='block') placeForge(); });
if(modesel){
  modesel.addEventListener('click',function(e){ const real=e.target.closest('[data-mode]'); if(real) closeForge(); });
}
})();
