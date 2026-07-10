import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPhbUZY6lpIHfRoZ9xlgeKOTJ7xrF4WvM",
  authDomain: "khalaf-paper-archive.firebaseapp.com",
  projectId: "khalaf-paper-archive",
  storageBucket: "khalaf-paper-archive.firebasestorage.app",
  messagingSenderId: "892725097110",
  appId: "1:892725097110:web:2055f92a2161114a79c8b7",
  measurementId: "G-H93RFXW8J3"
};

const USER_EMAILS = {
  MO: "mo@khalaf.com",
  AHMED: "ahmed@khalaf.com",
  HUSSEIN: "hussein@khalaf.com",
  USER1: "user@khalaf.com"
};

const configReady = !Object.values(firebaseConfig).some(v => String(v).includes("PUT_YOUR"));
let auth, db;
const state = {customers:[], suppliers:[], attachmentTypes:[], records:[], currentUser:"", currentEmail:"", selectedImage:"", unsub:[]};

const LIST_PAGE_SIZE = 6;

const MANAGE_USERS = new Set(["MO", "AHMED"]);
function canManage(){
  return MANAGE_USERS.has(String(state.currentUser || "").trim().toUpperCase());
}
function denyManageAction(){
  toast("ليس لديك صلاحية للتعديل أو الحذف.");
}

const queryUiState = {
  customer: { executed: false },
  supplier: { executed: false }
};

const listUiState = {
  customers: { search: "", page: 1 },
  suppliers: { search: "", page: 1 },
  attachmentTypes: { search: "", page: 1 }
};


const $ = id => document.getElementById(id);

function closeAllSmartSelects(except=null){
  document.querySelectorAll(".smart-select.open").forEach(w=>{
    if(w!==except) w.classList.remove("open");
  });
}

function enhanceSelect(select){
  if(!select || select.dataset.enhanced==="1") return;
  select.dataset.enhanced="1";
  select.classList.add("smart-select-native");

  const wrapper=document.createElement("div");
  wrapper.className="smart-select";

  const trigger=document.createElement("button");
  trigger.type="button";
  trigger.className="smart-select-trigger";

  const valueSpan=document.createElement("span");
  valueSpan.className="smart-select-value";

  const menu=document.createElement("div");
  menu.className="smart-select-menu";

  const backdrop=document.createElement("div");
  backdrop.className="smart-select-backdrop";

  const searchBox=document.createElement("div");
  searchBox.className="smart-select-search";
  searchBox.innerHTML=`<div class="smart-select-search-wrap"><input type="text" placeholder="اكتب للبحث..."></div>`;

  const optionsBox=document.createElement("div");
  optionsBox.className="smart-select-options";

  select.parentNode.insertBefore(wrapper,select);
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(backdrop);
  wrapper.appendChild(menu);
  menu.appendChild(searchBox);
  menu.appendChild(optionsBox);
  trigger.appendChild(valueSpan);

  const searchInput=searchBox.querySelector("input");
  let smartPage=1;
  const SMART_PAGE_SIZE=6;

  function syncLabel(){
    const option=select.options[select.selectedIndex];
    const label=option?.textContent?.trim()||"اختر...";
    valueSpan.textContent=label;
    valueSpan.classList.toggle("placeholder",!select.value);
  }

  function renderOptions(filter=""){
    const q=filter.trim().toLowerCase();
    const matched=[...select.options].filter(o=>{
      if(!o.value) return false;
      return !q || o.textContent.toLowerCase().includes(q);
    });

    const totalPages=Math.max(1,Math.ceil(matched.length/SMART_PAGE_SIZE));
    if(smartPage>totalPages) smartPage=totalPages;
    if(smartPage<1) smartPage=1;

    const start=(smartPage-1)*SMART_PAGE_SIZE;
    const visible=matched.slice(start,start+SMART_PAGE_SIZE);

    const optionHtml=visible.length
      ? visible.map(o=>`
          <button type="button"
                  class="smart-select-option ${o.value===select.value?"selected":""}"
                  data-value="${esc(o.value)}">
            <span>${esc(o.textContent)}</span>
          </button>`).join("")
      : `<div class="smart-select-empty">لا توجد نتائج مطابقة.</div>`;

    const pagerHtml=matched.length>SMART_PAGE_SIZE
      ? `<div class="smart-select-pager">
           <button type="button" class="smart-select-page-btn" data-page="${smartPage-1}" ${smartPage===1?"disabled":""}>‹</button>
           <span class="smart-select-page-info">${smartPage} / ${totalPages}</span>
           <button type="button" class="smart-select-page-btn" data-page="${smartPage+1}" ${smartPage===totalPages?"disabled":""}>›</button>
         </div>`
      : "";

    optionsBox.innerHTML=optionHtml+pagerHtml;

    optionsBox.querySelectorAll(".smart-select-option").forEach(btn=>{
      btn.addEventListener("click",()=>{
        select.value=btn.dataset.value;
        select.dispatchEvent(new Event("change",{bubbles:true}));
        syncLabel();
        wrapper.classList.remove("open");
        searchInput.value="";
        smartPage=1;
        renderOptions("");
      });
    });

    optionsBox.querySelectorAll(".smart-select-page-btn").forEach(btn=>{
      btn.addEventListener("click",e=>{
        e.preventDefault();
        e.stopPropagation();
        if(btn.disabled)return;
        smartPage=Number(btn.dataset.page)||1;
        renderOptions(searchInput.value);
        optionsBox.scrollTop=0;
      });
    });
  }

  function openMenu(){
    smartPage=1;
    closeAllSmartSelects(wrapper);
    wrapper.classList.add("open");
    searchInput.value="";
    renderOptions("");
    setTimeout(()=>searchInput.focus(),30);
  }

  trigger.addEventListener("click",()=>{
    wrapper.classList.contains("open")
      ? wrapper.classList.remove("open")
      : openMenu();
  });

  backdrop.addEventListener("click",()=>wrapper.classList.remove("open"));

  searchInput.addEventListener("input",()=>{smartPage=1;renderOptions(searchInput.value)});

  searchInput.addEventListener("keydown",e=>{
    if(e.key==="Escape") wrapper.classList.remove("open");
  });

  select.addEventListener("change",()=>{
    syncLabel();
    renderOptions(searchInput.value);
  });

  syncLabel();
  renderOptions("");
}

function enhanceAllSelects(root=document){
  root.querySelectorAll("select.control").forEach(enhanceSelect);
}

document.addEventListener("click",e=>{
  if(!e.target.closest(".smart-select")) closeAllSmartSelects();
});

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function today(){return new Date().toISOString().slice(0,10)}
function fmtDate(d){return d?new Date(d+"T00:00:00").toLocaleDateString("ar-EG"):"—"}
function fmtDateTime(v){
  if(!v)return "—";
  const d=new Date(ts(v));
  if(Number.isNaN(d.getTime()))return "—";
  return d.toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function registrationDateKey(v){
  if(!v)return "";
  const d=new Date(ts(v));
  if(Number.isNaN(d.getTime()))return "";
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function ts(v){if(!v)return "";if(typeof v==="string")return v;if(v.toDate)return v.toDate().toISOString();if(typeof v.seconds==="number")return new Date(v.seconds*1000).toISOString();return "";}

function createdTime(value){
  if(!value) return Number.MAX_SAFE_INTEGER;
  if(typeof value.toMillis==="function") return value.toMillis();
  if(typeof value.seconds==="number") return value.seconds*1000;
  const parsed=new Date(value).getTime();
  return Number.isFinite(parsed)?parsed:Number.MAX_SAFE_INTEGER;
}
function sortByCreatedAsc(a,b){
  const diff=createdTime(a.createdAt)-createdTime(b.createdAt);
  if(diff!==0) return diff;
  return (a.name||"").localeCompare(b.name||"","ar");
}

function toast(msg){const e=$("toast");e.textContent=msg;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2800)}
function errMsg(e){const c=e?.code||"";if(/invalid-credential|wrong-password|user-not-found/.test(c))return "اسم المستخدم أو كلمة المرور غير صحيحة.";if(c.includes("network"))return "تعذر الاتصال بالإنترنت.";if(c.includes("permission-denied"))return "ليس لديك صلاحية لتنفيذ هذه العملية.";return e?.message||"حدث خطأ غير متوقع."}
function download(name,content,type="application/json"){const b=new Blob([content],{type}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

if(!configReady){$("loginError").classList.remove("hidden");$("loginError").textContent="تعذر تشغيل النظام. يرجى التواصل مع المسؤول.";document.querySelector('#loginForm button[type="submit"]').disabled=true;}
else {const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);}

$("togglePass").onclick=()=>{const p=$("password");p.type=p.type==="password"?"text":"password"};
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); if(!configReady)return;
  const u=$("username").value.trim().toUpperCase(), p=$("password").value, email=USER_EMAILS[u];
  if(!email){$("loginError").textContent="اسم المستخدم أو كلمة المرور غير صحيحة.";$("loginError").classList.remove("hidden");return;}
  const btn=e.submitter;btn.disabled=true;btn.textContent="جاري تسجيل الدخول...";
  try{await signInWithEmailAndPassword(auth,email,p);localStorage.setItem("kh_display_user",u)}catch(x){$("loginError").textContent=errMsg(x);$("loginError").classList.remove("hidden")}
  finally{btn.disabled=false;btn.textContent="تسجيل الدخول"}
});
$("logoutBtn").onclick=()=>signOut(auth);
const savedTheme=localStorage.getItem("kh_theme")||"light";
document.body.classList.toggle("dark",savedTheme==="dark");
if($("themeBtn")){
  $("themeBtn").textContent=savedTheme==="dark"?"☀️":"🌙";
  $("themeBtn").onclick=()=>{
    const dark=!document.body.classList.contains("dark");
    document.body.classList.toggle("dark",dark);
    localStorage.setItem("kh_theme",dark?"dark":"light");
    $("themeBtn").textContent=dark?"☀️":"🌙";
  };
}

if(configReady) onAuthStateChanged(auth,user=>{
  if(user){state.currentEmail=user.email||"";state.currentUser=Object.keys(USER_EMAILS).find(k=>USER_EMAILS[k]===user.email)||localStorage.getItem("kh_display_user")||"USER";startApp();subscribeAll()}
  else{cleanup();$("appPage").classList.add("hidden");$("loginPage").classList.remove("hidden");$("password").value=""}
});
function cleanup(){state.unsub.forEach(f=>{try{f()}catch{}});state.unsub=[]}
function subscribeAll(){cleanup();
  state.unsub.push(onSnapshot(collection(db,"customers"),s=>{state.customers=s.docs.map(d=>({id:d.id,...d.data()})).sort(sortByCreatedAsc);renderAll()},e=>toast(errMsg(e))));
  state.unsub.push(onSnapshot(collection(db,"suppliers"),s=>{state.suppliers=s.docs.map(d=>({id:d.id,...d.data()})).sort(sortByCreatedAsc);renderAll()},e=>toast(errMsg(e))));
  state.unsub.push(onSnapshot(collection(db,"attachmentTypes"),s=>{state.attachmentTypes=s.docs.map(d=>({id:d.id,...d.data()})).sort(sortByCreatedAsc);renderAll()},e=>toast(errMsg(e))));
  state.unsub.push(onSnapshot(collection(db,"records"),s=>{state.records=s.docs.map(d=>{const x=d.data();return{id:d.id,...x,createdAt:ts(x.createdAt),updatedAt:ts(x.updatedAt)}}).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));renderAll()},e=>toast(errMsg(e))));
}
function startApp(){$("loginPage").classList.add("hidden");$("appPage").classList.remove("hidden");$("currentUser").textContent=state.currentUser;$("avatar").textContent=state.currentUser[0];renderAll();goPage("dashboard");enhanceAllSelects()}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>goPage(b.dataset.page)));
function goPage(page){document.querySelectorAll(".page-section").forEach(s=>s.classList.add("hidden"));$(page)?.classList.remove("hidden");document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));window.scrollTo({top:0,behavior:"smooth"});if(page==="customerQuery")renderQuery("customer");if(page==="supplierQuery")renderQuery("supplier")}
function renderAll(){if($("appPage").classList.contains("hidden"))return;renderDashboard();renderLists();if(!$("customerEntry").dataset.editing)renderEntry("customer");if(!$("supplierEntry").dataset.editing)renderEntry("supplier");renderBackup();if(!$("customerQuery").classList.contains("hidden"))renderQuery("customer");if(!$("supplierQuery").classList.contains("hidden"))renderQuery("supplier")}

function renderDashboard(){const c=state.records.filter(r=>r.entityType==="customer").length,s=state.records.filter(r=>r.entityType==="supplier").length,total=state.records.reduce((a,r)=>a+(Number(r.value)||0),0),recent=state.records.slice(0,6);$("dashboard").innerHTML=`<div class="page-head"><div><h2>لوحة التحكم</h2><p>نظرة سريعة على أرشيف مخزن خلاف للورق.</p></div></div><div class="stats"><div class="stat"><span>مرفقات العملاء</span><strong>${c}</strong></div><div class="stat"><span>مرفقات الموردين</span><strong>${s}</strong></div><div class="stat"><span>إجمالي المرفقات</span><strong>${state.records.length}</strong></div><div class="stat"><span>إجمالي القيم</span><strong>${total.toLocaleString("ar-EG")}</strong></div></div><div class="card"><div class="card-title"><h3>أحدث المرفقات</h3></div>${recent.length?table(recent):'<div class="empty">لا توجد مرفقات مسجلة حتى الآن.</div>'}</div>`}

function renderLists(){
  $("lists").innerHTML=`
    <div class="page-head">
      <div>
        <h2>القوائم الأساسية</h2>
        <p>إدارة العملاء والموردين وأنواع المرفقات.</p>
      </div>
    </div>
    <div class="grid grid-3">
      ${listCard("customers","قائمة العملاء","اسم العميل")}
      ${listCard("suppliers","قائمة الموردين","اسم المورد")}
      ${listCard("attachmentTypes","أنواع المرفقات","نوع المرفق")}
    </div>`;
  bindListSearchInputs();
}

function listCard(key,title,ph){
  const all=state[key];
  const ui=listUiState[key];
  const term=ui.search.trim().toLowerCase();

  const filtered=term
    ? all.filter(x=>(x.name||"").toLowerCase().includes(term))
    : all;

  const totalPages=Math.max(1,Math.ceil(filtered.length/LIST_PAGE_SIZE));
  if(ui.page>totalPages) ui.page=totalPages;
  if(ui.page<1) ui.page=1;

  const start=(ui.page-1)*LIST_PAGE_SIZE;
  const pageItems=filtered.slice(start,start+LIST_PAGE_SIZE);

  return `
    <div class="card">
      <div class="card-title">
        <h3>${title}</h3>
        <span class="badge">${all.length}</span>
      </div>

      <div class="list-toolbar">
        <div class="list-search">
          <span class="search-icon">⌕</span>
          <input
            id="search_${key}"
            value="${esc(ui.search)}"
            placeholder="بحث داخل القائمة..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="list-add-row">
        <input class="control" id="input_${key}" placeholder="${ph}">
        <button class="btn btn-primary" onclick="addListItem('${key}')">إضافة</button>
      </div>

      <div class="list-items" id="items_${key}">
        ${pageItems.length
          ? pageItems.map(x=>`
              <div class="list-row">
                <span class="item-name" title="${esc(x.name)}">${esc(x.name)}</span>
                ${canManage()?`<button class="btn btn-danger" onclick="deleteListItem('${key}','${x.id}')">حذف</button>`:""}
              </div>
            `).join("")
          : `<div class="list-empty-state">
               <div class="empty-icon">⌕</div>
               <div>${term?"لا توجد نتائج مطابقة.":"القائمة فارغة."}</div>
             </div>`
        }
      </div>

      <div class="list-footer">
        <div class="list-count">
          ${filtered.length
            ? `عرض ${start+1} - ${Math.min(start+LIST_PAGE_SIZE,filtered.length)} من ${filtered.length}`
            : "لا توجد عناصر"}
        </div>
        ${paginationHtml(key,ui.page,totalPages)}
      </div>
    </div>`;
}

function paginationHtml(key,current,total){
  if(total<=1){
    return `<div class="pagination">
      <button class="page-btn" disabled>‹</button>
      <button class="page-btn active">1</button>
      <button class="page-btn" disabled>›</button>
    </div>`;
  }

  const pages=[];
  const add=p=>{if(p>=1&&p<=total&&!pages.includes(p))pages.push(p)};

  add(1);
  add(current-1);
  add(current);
  add(current+1);
  add(total);
  pages.sort((a,b)=>a-b);

  let html=`<div class="pagination">
    <button class="page-btn" ${current===1?"disabled":""} onclick="changeListPage('${key}',${current-1})">‹</button>`;

  let prev=0;
  for(const p of pages){
    if(prev && p-prev>1) html+=`<span class="page-ellipsis">…</span>`;
    html+=`<button class="page-btn ${p===current?"active":""}" onclick="changeListPage('${key}',${p})">${p}</button>`;
    prev=p;
  }

  html+=`<button class="page-btn" ${current===total?"disabled":""} onclick="changeListPage('${key}',${current+1})">›</button></div>`;
  return html;
}

function bindListSearchInputs(){
  ["customers","suppliers","attachmentTypes"].forEach(key=>{
    const addInput=$("input_"+key);
    if(addInput){
      addInput.addEventListener("keydown",e=>{
        if(e.key==="Enter"){
          e.preventDefault();
          addListItem(key);
        }
      });
    }
    const input=$("search_"+key);
    if(!input) return;
    input.addEventListener("input",e=>{
      listUiState[key].search=e.target.value;
      listUiState[key].page=1;
      renderLists();
      requestAnimationFrame(()=>{
        const refreshed=$("search_"+key);
        if(refreshed){
          refreshed.focus();
          const len=refreshed.value.length;
          refreshed.setSelectionRange(len,len);
        }
      });
    });
  });
}

window.changeListPage=(key,page)=>{
  listUiState[key].page=page;
  renderLists();
  const section=$("lists");
  if(section && window.innerWidth<900){
    section.scrollIntoView({behavior:"smooth",block:"start"});
  }
};

window.addListItem=async key=>{
  const input=$("input_"+key),v=input.value.trim();
  if(!v)return toast("اكتب الاسم أولاً.");
  if(state[key].some(x=>(x.name||"").toLowerCase()===v.toLowerCase()))return toast("هذا الاسم موجود بالفعل.");
  try{
    await addDoc(collection(db,key),{name:v,createdBy:state.currentUser,createdAt:serverTimestamp()});
    listUiState[key].search="";
    listUiState[key].page=1;
    toast("تمت الإضافة بنجاح.");
  }catch(e){toast(errMsg(e))}
};

window.deleteListItem=async(key,id)=>{
  if(!canManage()) return denyManageAction();
  if(!confirm("هل تريد حذف هذا العنصر؟"))return;
  try{
    await deleteDoc(doc(db,key,id));
    toast("تم الحذف.");
  }catch(e){toast(errMsg(e))}
};

function opts(arr,selected=""){return '<option value="">اختر...</option>'+arr.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${esc(x.name)}</option>`).join("")}

function renderEntry(type,record=null){const isC=type==="customer",target=$(isC?"customerEntry":"supplierEntry"),list=isC?state.customers:state.suppliers,title=isC?"العميل":"المورد",r=record||{};if(record)target.dataset.editing="1";else delete target.dataset.editing;state.selectedImage=r.imageData||"";target.innerHTML=`<div class="page-head"><div><h2>${record?"تعديل":"إضافة"} مرفق ${title}</h2><p>سجّل البيانات وارفع صورة من الهاتف أو الكمبيوتر.</p></div><button class="btn btn-secondary" onclick="openPrevious('${type}')">السابق</button></div><div class="card"><form id="${type}Form"><div class="grid grid-3"><div class="field"><label>${title}</label><select class="control" id="${type}_entity" required>${opts(list,r.entityId)}</select></div><div class="field"><label>نوع المرفق</label><select class="control" id="${type}_attachment" required>${opts(state.attachmentTypes,r.attachmentTypeId)}</select></div><div class="field"><label>التاريخ</label><input class="control" type="date" id="${type}_date" value="${r.date||today()}" required></div><div class="field"><label>القيمة <small style="color:#8a94a3">(اختياري)</small></label><input class="control" type="number" min="0" step="0.01" id="${type}_value" value="${r.value??""}"></div><div class="field full"><label>ملاحظات <small style="color:#8a94a3">(اختياري)</small></label><textarea class="control" id="${type}_notes">${esc(r.notes||"")}</textarea></div><div class="field full"><label>صورة المرفق</label><label class="upload"><input type="file" accept="image/jpeg,image/png,image/webp" id="${type}_image"><div style="font-size:29px">📷</div><strong>اضغط للتصوير أو اختيار صورة</strong><div class="preview" id="${type}_preview" style="${state.selectedImage?"display:block":""}">${state.selectedImage?`<img src="${state.selectedImage}">`:""}</div></label></div></div><div class="actions"><button class="btn btn-primary" id="${type}_save" type="submit">${record?"حفظ التعديلات":"حفظ المرفق"}</button>${record?`<button class="btn btn-secondary" type="button" onclick="cancelEdit('${type}')">إلغاء</button>`:""}</div></form></div><div class="section-note">تأكد من وضوح صورة المرفق قبل الحفظ.</div>`;
  enhanceAllSelects(target);
  $(type+"_image").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{toast("جاري تجهيز الصورة...");state.selectedImage=await compress(f);const p=$(type+"_preview");p.style.display="block";p.innerHTML=`<img src="${state.selectedImage}">`;toast("تم تجهيز الصورة.")}catch(x){toast(x.message)}});
  $(type+"Form").addEventListener("submit",async e=>{e.preventDefault();const entityId=$(type+"_entity").value,attachmentTypeId=$(type+"_attachment").value,entity=list.find(x=>x.id===entityId),at=state.attachmentTypes.find(x=>x.id===attachmentTypeId);if(!entity||!at)return toast("أكمل البيانات المطلوبة.");const btn=$(type+"_save");btn.disabled=true;btn.textContent="جاري الحفظ...";const payload={entityType:type,entityId,entityName:entity.name,attachmentTypeId,attachmentType:at.name,date:$(type+"_date").value,value:$(type+"_value").value,notes:$(type+"_notes").value.trim(),imageData:state.selectedImage||"",uploadedBy:record?.uploadedBy||state.currentUser,uploadedByEmail:record?.uploadedByEmail||state.currentEmail,updatedBy:state.currentUser,updatedAt:serverTimestamp()};try{if(record){if(!canManage()){btn.disabled=false;btn.textContent="حفظ التعديلات";return denyManageAction()}await updateDoc(doc(db,"records",record.id),payload)}else{payload.createdAt=serverTimestamp();await addDoc(collection(db,"records"),payload)}target.removeAttribute("data-editing");state.selectedImage="";renderEntry(type);toast(record?"تم حفظ التعديلات.":"تم حفظ المرفق.")}catch(x){toast(errMsg(x));btn.disabled=false;btn.textContent=record?"حفظ التعديلات":"حفظ المرفق"}})
}
function fileData(f){return new Promise((res,rej)=>{const r=new FileReader;r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
function imageLoad(src){return new Promise((res,rej)=>{const i=new Image;i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function compress(file){if(!file.type.startsWith("image/"))throw new Error("اختر صورة صحيحة.");const img=await imageLoad(await fileData(file));let max=Math.min(1280,img.width),q=.78,result="";for(let n=0;n<12;n++){const ratio=Math.min(1,max/img.width),w=Math.round(img.width*ratio),h=Math.round(img.height*ratio),c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);result=c.toDataURL("image/jpeg",q);if(result.length<650000)return result;if(q>.42)q-=.08;else max=Math.round(max*.82)}if(result.length>=800000)throw new Error("الصورة كبيرة جداً. صوّرها بدقة أقل.");return result}
window.cancelEdit=type=>{const t=$(type==="customer"?"customerEntry":"supplierEntry");t.removeAttribute("data-editing");state.selectedImage="";renderEntry(type)};
window.openPrevious=type=>{const rows=state.records.filter(r=>r.entityType===type);$("archiveTitle").textContent=type==="customer"?"السابق — مرفقات العملاء":"السابق — مرفقات الموردين";$("archiveContent").innerHTML=rows.length?table(rows):'<div class="empty">لا توجد بيانات سابقة.</div>';$("archiveModal").classList.add("show")};
window.closeModal=()=>$("archiveModal").classList.remove("show");
function table(rows){return `<div class="table-wrap"><table><thead><tr><th>الصورة</th><th>الاسم</th><th>النوع</th><th>تاريخ المرفق</th><th>تاريخ ووقت التسجيل</th><th>القيمة</th><th>المستخدم المسجل</th><th>ملاحظات</th><th>إجراءات</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.imageData?`<button style="border:0;background:none" onclick="viewImage('${r.id}')"><img class="thumb" src="${r.imageData}"></button>`:'<div class="thumb" style="display:grid;place-items:center">—</div>'}</td><td><strong>${esc(r.entityName)}</strong></td><td><span class="badge">${esc(r.attachmentType)}</span></td><td>${fmtDate(r.date)}</td><td><span class="registration-datetime">${fmtDateTime(r.createdAt)}</span></td><td>${r.value!==""&&r.value!=null?Number(r.value).toLocaleString("ar-EG"):"—"}</td><td><strong>${esc(r.uploadedBy||r.createdBy||"—")}</strong></td><td>${esc(r.notes||"—")}</td><td><div class="mini-actions">${r.imageData?`<button class="btn-success" onclick="downloadImage('${r.id}')">تنزيل</button>`:""}${canManage()?`<button class="btn-gold" onclick="editRecord('${r.id}')">تعديل</button><button class="btn-danger" onclick="deleteRecord('${r.id}')">حذف</button>`:""}</div></td></tr>`).join("")}</tbody></table></div>`}
window.viewImage=id=>{const r=state.records.find(x=>x.id===id);if(!r?.imageData)return;const w=window.open();if(!w)return toast("اسمح بفتح النوافذ المنبثقة.");w.document.write(`<style>body{margin:0;background:#111;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style><img src="${r.imageData}">`);w.document.close()};
window.editRecord=id=>{if(!canManage())return denyManageAction();const r=state.records.find(x=>x.id===id);if(!r)return;closeModal();renderEntry(r.entityType,r);goPage(r.entityType==="customer"?"customerEntry":"supplierEntry")};
window.deleteRecord=async id=>{if(!canManage())return denyManageAction();if(!confirm("هل تريد حذف هذا المرفق نهائياً؟"))return;try{await deleteDoc(doc(db,"records",id));closeModal();toast("تم الحذف.")}catch(e){toast(errMsg(e))}};
window.downloadImage=id=>{const r=state.records.find(x=>x.id===id);if(!r?.imageData)return;const a=document.createElement("a");a.href=r.imageData;a.download=`${r.entityName}_${r.attachmentType}_${r.date}.jpg`;document.body.appendChild(a);a.click();a.remove()};

function renderQuery(type){
  const isC=type==="customer";
  const page=$(isC?"customerQuery":"supplierQuery");
  const list=isC?state.customers:state.suppliers;
  const executed=queryUiState[type].executed;

  page.innerHTML=`
    <div class="page-head">
      <div>
        <h2>استعلامات ${isC?"العملاء":"الموردين"}</h2>
        <p>حدد معايير البحث ثم اضغط استعلام.</p>
      </div>
      ${executed?`<button class="btn btn-primary" onclick="exportFiltered('${type}')">تنزيل النتائج CSV</button>`:""}
    </div>

    <div class="card">
      <div class="filters-bar">
        <div class="field">
          <label>${isC?"العميل":"المورد"}</label>
          <select class="control filter" id="q_entity">
            <option value="">الكل</option>
            ${list.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>نوع المرفق</label>
          <select class="control filter" id="q_type">
            <option value="">الكل</option>
            ${state.attachmentTypes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>من تاريخ المرفق</label><input class="control filter" id="q_from" type="date"></div>
        <div class="field"><label>إلى تاريخ المرفق</label><input class="control filter" id="q_to" type="date"></div>
        <div class="field"><label>تسجيل من تاريخ</label><input class="control filter" id="q_created_from" type="date"></div>
        <div class="field"><label>تسجيل إلى تاريخ</label><input class="control filter" id="q_created_to" type="date"></div>
        <div class="field"><label>بحث عام</label><input class="control filter" id="q_text" placeholder="اسم أو ملاحظة أو مستخدم"></div>
      </div>

      <div class="query-action-row">
        <button class="btn btn-primary" onclick="runQuery('${type}')">استعلام</button>
        <button class="btn btn-secondary" onclick="clearFilters('${type}')">مسح الفلاتر</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <h3>النتائج</h3>
        ${executed?`<span class="badge" id="resultCount">0</span>`:""}
      </div>
      <div id="queryResults">
        ${executed
          ? ""
          : `<div class="query-placeholder">
               <div class="query-icon">⌕</div>
               <strong>لم يتم تنفيذ استعلام بعد</strong>
               <span>حدد الفلاتر المناسبة ثم اضغط زر استعلام لعرض النتائج.</span>
             </div>`
        }
      </div>
    </div>`;

  enhanceAllSelects(page);

  if(executed) apply(type);
}

window.runQuery=type=>{
  queryUiState[type].executed=true;
  const rows=filtered(type);
  const count=$("resultCount");
  const results=$("queryResults");

  if(count) count.textContent=rows.length;
  if(results) results.innerHTML=rows.length
    ? table(rows)
    : '<div class="empty">لا توجد نتائج مطابقة.</div>';

  const exportBtn=document.querySelector(
    `#${type==="customer"?"customerQuery":"supplierQuery"} .page-head .btn-primary`
  );
  if(!exportBtn){
    const head=document.querySelector(
      `#${type==="customer"?"customerQuery":"supplierQuery"} .page-head`
    );
    if(head){
      const btn=document.createElement("button");
      btn.className="btn btn-primary";
      btn.textContent="تنزيل النتائج CSV";
      btn.onclick=()=>exportFiltered(type);
      head.appendChild(btn);
    }
  }
};

function filtered(type){
  const entity=$("q_entity")?.value||"",at=$("q_type")?.value||"",from=$("q_from")?.value||"",to=$("q_to")?.value||"",createdFrom=$("q_created_from")?.value||"",createdTo=$("q_created_to")?.value||"",text=($("q_text")?.value||"").toLowerCase();
  return state.records
    .filter(r=>r.entityType===type)
    .filter(r=>!entity||r.entityId===entity)
    .filter(r=>!at||r.attachmentTypeId===at)
    .filter(r=>!from||r.date>=from)
    .filter(r=>!to||r.date<=to)
    .filter(r=>{const d=registrationDateKey(r.createdAt);return !createdFrom||(d&&d>=createdFrom)})
    .filter(r=>{const d=registrationDateKey(r.createdAt);return !createdTo||(d&&d<=createdTo)})
    .filter(r=>!text||[r.entityName,r.attachmentType,r.notes,r.uploadedBy,r.uploadedByEmail].join(" ").toLowerCase().includes(text))
    .sort((a,b)=>createdTime(b.createdAt)-createdTime(a.createdAt));
}
function apply(type){
  if(!queryUiState[type].executed)return;
  const rows=filtered(type);
  const count=$("resultCount");
  const results=$("queryResults");
  if(count)count.textContent=rows.length;
  if(results)results.innerHTML=rows.length?table(rows):'<div class="empty">لا توجد نتائج مطابقة.</div>';
}
window.clearFilters=type=>{["q_entity","q_type","q_from","q_to","q_created_from","q_created_to","q_text"].forEach(id=>{const e=$(id);if(e)e.value=""});apply(type)};
window.exportFiltered=type=>{if(!queryUiState[type].executed)return toast("نفّذ الاستعلام أولاً.");const rows=filtered(type);if(!rows.length)return toast("لا توجد نتائج.");const csv=[["النوع","الاسم","نوع المرفق","تاريخ المرفق","تاريخ ووقت التسجيل","القيمة","الملاحظات","المستخدم المسجل","بريد المستخدم"],...rows.map(r=>[r.entityType==="customer"?"عميل":"مورد",r.entityName,r.attachmentType,r.date,fmtDateTime(r.createdAt),r.value||"",r.notes||"",r.uploadedBy||r.createdBy||"",r.uploadedByEmail||""])].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");download(`archive_${type}_${today()}.csv`,"\ufeff"+csv,"text/csv;charset=utf-8")};
function renderBackup(){$("backup").innerHTML=`<div class="page-head"><div><h2>النسخة الاحتياطية</h2><p>نزّل نسخة من جميع البيانات والصور.</p></div></div><div class="card"><div class="card-title"><h3>تنزيل نسخة احتياطية</h3></div><p style="color:var(--muted)">احتفظ بنسخة دورية من بيانات النظام.</p><button class="btn btn-primary" onclick="exportBackup()">تنزيل النسخة</button></div>`}
window.exportBackup=()=>download(`khalaf_paper_backup_${today()}.json`,JSON.stringify({version:2,exportedAt:new Date().toISOString(),customers:state.customers,suppliers:state.suppliers,attachmentTypes:state.attachmentTypes,records:state.records},null,2));
